//! A tiny size-class allocator for wasm32: power-of-two classes, each with a
//! free list; new blocks are bumped from fresh linear-memory pages. Blocks are
//! naturally aligned (up to 4 KiB), so any layout whose alignment is not larger
//! than its class is satisfied by any block of that class.

use core::alloc::{GlobalAlloc, Layout};
use core::cell::UnsafeCell;

const CLASSES: usize = 34; // up to 2^33 bytes (more than wasm32 can hold)
const PAGE: usize = 65536;

struct State { free: [usize; CLASSES], top: usize, end: usize }
struct Cell(UnsafeCell<State>);
unsafe impl Sync for Cell {}
static ST: Cell = Cell(UnsafeCell::new(State { free: [0; CLASSES], top: 0, end: 0 }));

pub struct ClassAlloc;

#[inline]
fn class_of(l: &Layout) -> (usize, usize) {
    let s = l.size().max(l.align()).max(16).next_power_of_two();
    (s.trailing_zeros() as usize, s)
}

unsafe impl GlobalAlloc for ClassAlloc {
    unsafe fn alloc(&self, l: Layout) -> *mut u8 {
        let (c, s) = class_of(&l);
        if c >= CLASSES { return core::ptr::null_mut(); }
        let st = unsafe { &mut *ST.0.get() };
        let head = st.free[c];
        if head != 0 {
            st.free[c] = unsafe { *(head as *const usize) };
            return head as *mut u8;
        }
        if st.top == 0 {
            let pages = core::arch::wasm32::memory_size(0);
            st.top = pages * PAGE;
            st.end = st.top;
        }
        let al = s.min(4096).max(l.align());
        let a = (st.top + al - 1) & !(al - 1);
        let e = match a.checked_add(s) { Some(e) => e, None => return core::ptr::null_mut() };
        if e > st.end {
            let need = (e - st.end + PAGE - 1) / PAGE;
            let grow = need.max(16);
            if core::arch::wasm32::memory_grow(0, grow) == usize::MAX {
                if core::arch::wasm32::memory_grow(0, need) == usize::MAX { return core::ptr::null_mut(); }
                st.end += need * PAGE;
            } else {
                st.end += grow * PAGE;
            }
        }
        st.top = e;
        a as *mut u8
    }
    unsafe fn dealloc(&self, p: *mut u8, l: Layout) {
        let (c, _) = class_of(&l);
        if c >= CLASSES || p.is_null() { return; }
        let st = unsafe { &mut *ST.0.get() };
        unsafe { *(p as *mut usize) = st.free[c]; }
        st.free[c] = p as usize;
    }
    unsafe fn realloc(&self, p: *mut u8, l: Layout, new_size: usize) -> *mut u8 {
        let (c_old, _) = class_of(&l);
        let nl = unsafe { Layout::from_size_align_unchecked(new_size, l.align()) };
        let (c_new, _) = class_of(&nl);
        if c_new == c_old { return p; }
        let q = unsafe { self.alloc(nl) };
        if !q.is_null() {
            unsafe { core::ptr::copy_nonoverlapping(p, q, l.size().min(new_size)); self.dealloc(p, l); }
        }
        q
    }
}
