# Clock

[![CI](https://github.com/redSlug/clock/actions/workflows/ci.yml/badge.svg)](https://github.com/redSlug/clock/actions/workflows/ci.yml)

A Cloudflare Worker API that stores circular p5.js clock faces, plus a Raspberry Pi that shows them on a round LCD display over HDMI.

**Live at https://clock.recurse.com/** (display page: https://clock.recurse.com/display)

<p align="center"><img src="docs/images/clock-face.png" width="360" alt="The tick-marks example face, a round clock showing 10:10"></p>

## Architecture

One Worker, and it is only an API: sign in, upload a face, fetch a face, fetch the page. The Raspberry Pi is a thin display. Its browser asks the API for a new face every minute. Clock is the theme, but a face can be any circular p5.js sketch.

```mermaid
flowchart LR
    CLIENT["Clients<br/>developer or phone"]
    PI["Raspberry Pi<br/>fullscreen browser<br/>fetches a new face every minute"]
    LCD(("Circular LCD display"))

    API["Cloudflare Worker API<br/>sign in, upload face,<br/>get face, get page"]

    RC["Recurse Center<br/>OAuth"]
    D1[("D1 (SQLite)<br/>users, sessions, faces")]
    R2[("R2<br/>p5 files")]

    CLIENT --> API
    PI --> API
    PI ==>|"HDMI"| LCD
    API --> RC
    API --> D1
    API --> R2

    classDef people fill:#dbeafe,stroke:#2563eb,color:#1f2937,stroke-width:2px
    classDef hardware fill:#dcfce7,stroke:#16a34a,color:#1f2937,stroke-width:2px
    classDef code fill:#ffedd5,stroke:#ea580c,color:#1f2937,stroke-width:2px
    classDef storage fill:#ede9fe,stroke:#7c3aed,color:#1f2937,stroke-width:2px
    classDef outside fill:#fce7f3,stroke:#db2777,color:#1f2937,stroke-width:2px
    class CLIENT people
    class PI,LCD hardware
    class API code
    class D1,R2 storage
    class RC outside
```

Sign-in uses Recurse Center OAuth through Better Auth, the same setup as Batchmate. Data model and open questions are in the [design doc](docs/design.md).

> **A note on names:** this is a round **LCD** display, not LED. The Worker, D1 database, R2 bucket and npm package are named `circular-led-*` by mistake. They keep those names for now, because renaming them would change the deployed Worker. Everywhere else, it is LCD.

## Docs

- [Writing a face](docs/faces.md): the editor, who can do what, and the `face` object your sketch reads.
- [Run it locally](docs/local-development.md): set up and test on your own machine, no accounts needed.
- [Deploying](docs/deploying.md): the Cloudflare account rules and the GitHub Actions deploy.
- [Recurse sign-in](docs/sign-in.md): registering the OAuth app, and how sign-in works.
- [Design](docs/design.md): data model, decisions, open questions, and what each piece does.
- [Third-party code](docs/third-party.md): p5.js and its license.
- [TODO](docs/todo.md): what is left to do.
- [Cloudflare setup script](docs/setup-script.md)
- Rules for coding assistants: [CLAUDE.md](CLAUDE.md)

## Made by

[redSlug](https://github.com/redSlug) and [fcjr](https://github.com/fcjr).

## License

[MIT](LICENSE). The vendored p5.js is LGPL-2.1, see [third-party code](docs/third-party.md).
