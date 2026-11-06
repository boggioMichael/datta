[**Open the No Bank →**](https://boggiomichael.github.io/datta/piggy/)

## How it works

You pick how big the no is and tap the pig. A small no drops in as a nickel coin, a medium one as a brass coin, a big one as a bill that flutters down into the slot, and a huge one as a gold bar followed by a shower of coins. The pig squashes, hops and grins, sparks fly out of the slot, and the register on top rolls the total on its number wheels like the window of an old tin bank. A mistaken tap has an undo.

Every plan is its own pig, in its own colour, with its own worth for each size of no. Give it a goal and it grows rounder as it fills, then turns gold when it gets there. When a round is over you can break the bank with a hammer: the total goes into the history and a new pig starts from zero.

## The daily report

The history of a bank opens on a report: how many times no was said each day, as one column per day over two weeks, a month or three months, with the days that had a no, the daily average and the best day. Under it every day is listed with its no's, their sizes and the time each one was said.

## Sharing

There is no sign-up. The first time a phone or a browser opens the bank it makes itself a random key, and the server opens an account behind it. You choose for every bank who sees it: only you, everyone, or everyone without its name. Everyone else can browse the banks people chose to show, look at a pig and its daily report, and watch new coins fly in while they look, but never touch it. To open your banks on another device you copy the account key there.

## How it is built

The page is plain JavaScript with no libraries. The pig, the coins, the bill, the gold bar and the guilloche behind them are SVG drawn in code; the coins fly with the Web Animations API into a layer that ends at the slot, so they really disappear into the pig; every sound is synthesised on the spot with Web Audio. The bank is local-first: every tap is saved on the device at once and mirrored to the server when it answers, and the page works offline and installs to the home screen.

The sharing server is a small Node.js program with no dependencies. For now it runs on the studio's own computer and reaches the internet through a Cloudflare tunnel; each time it starts it publishes its address where the page looks for it. While it is off, nothing is lost: banks keep saving on each device and go up when it is back.
