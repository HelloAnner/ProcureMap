.PHONY: dev build check frontend-build tauri-check clean

dev:
	npm run tauri -- dev

build:
	npm run tauri -- build

check: frontend-build tauri-check

frontend-build:
	npm run build

tauri-check:
	cd src-tauri && cargo check

clean:
	rm -rf dist
	cd src-tauri && cargo clean
