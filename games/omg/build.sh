#!/usr/bin/env bash
# Builds the engine and copies it into the site.
# Needs the wasm target once:  rustup target add wasm32-unknown-unknown
set -euo pipefail
cd "$(dirname "$0")"
cargo build --release --target wasm32-unknown-unknown
cp target/wasm32-unknown-unknown/release/omg.wasm ../../public/omg/omg.wasm
ls -l ../../public/omg/omg.wasm
