# TechieDad Networking Toolkit

A small, client-side networking toolkit: IPv4/IPv6 subnet calculators, a VLSM planner, an IP address format converter, and a CIDR membership checker. Everything runs in the browser — no backend required.

Built by [TheTechieDad](https://www.thetechiedad.com), and adapted into a themed page on the site itself at `/networking-toolkit`. This repo is the standalone, original version — fork it, run it on its own, or reuse the calculator logic in your own project.

## Features

- **IPv4 Subnet Calculator** — network/broadcast address, subnet mask, wildcard mask, usable host range, IP class, and address scope from an IP + CIDR.
- **IPv6 Subnet Analyzer** — expands a compressed address, identifies address type (link-local, unique local, multicast, global unicast, documentation), and breaks out the network prefix / interface ID.
- **VLSM Planner** — allocate right-sized subnets from a base network for a list of named subnets with different host-count requirements.
- **IP Converter** — convert between dotted-decimal, 32-bit integer, hexadecimal, binary, octal, reverse DNS (PTR), and IPv4-mapped IPv6.
- **CIDR Membership Check** — test whether an IP falls inside a given network, and what role it plays (network/broadcast/host address).
- Dark and light themes, persisted locally.

## Tech stack

Create React App (`react-scripts` 5) + plain React state — no UI framework, no backend. All calculations run client-side.

## Getting started

```bash
npm install
npm start       # dev server at http://localhost:3000
npm run build   # production build, output in /build
```

`npm run build` produces a static `build/` folder that can be deployed anywhere that serves static files (Netlify, Vercel, GitHub Pages, S3, etc.) — no server-side component needed.

## Relationship to thetechiedad.com

This repo is kept as the standalone, open-source version of the toolkit. Its component logic and calculations were also ported into the [TheTechieDad.com](https://www.thetechiedad.com) Next.js site as a native page, restyled to sit inside that site's layout while keeping this project's own dark terminal-green look for the tool itself. The two aren't auto-synced, changes here don't automatically flow into the website, and vice versa.

## License

No license file yet. If you want to fork or reuse this, reach out or watch this repo for an update.
