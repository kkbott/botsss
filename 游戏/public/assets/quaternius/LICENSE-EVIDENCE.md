# Quaternius asset license evidence

Checked on **2026-11-10** before integrating any model.

The models used by this game come from five packs published by
[Quaternius](https://quaternius.com/). Each pack page has an explicit
**License** field linking to the
[CC0 1.0 Universal deed](https://creativecommons.org/publicdomain/zero/1.0/):

| Pack | Licence field on the official pack page | Source page |
| --- | --- | --- |
| Ultimate Crops Pack | `License … CC0` | https://quaternius.com/packs/ultimatecrops.html |
| Ultimate Animated Animal Pack | `License … CC0` | https://quaternius.com/packs/ultimateanimatedanimals.html |
| Ultimate Fantasy RTS | `License … CC0` | https://quaternius.com/packs/ultimatefantasyrts.html |
| Medieval Village Pack | `License … CC0` | https://quaternius.com/packs/medievalvillage.html |
| Ultimate Nature Pack | `License … CC0` | https://quaternius.com/packs/ultimatenature.html |

Example markup found on each page (2026-11-10):

```html
<div class="infoitem">
  <img src="/assets/svg/license.svg" class="iconBig"> License
  <div class="text-right">
    <a href="https://creativecommons.org/publicdomain/zero/1.0/" target="_blank">CC0</a>
  </div>
</div>
```

The GLB files themselves were downloaded from the public fan-made mirror
[`trebeljahr/quaternius-showcase`](https://github.com/trebeljahr/quaternius-showcase).
Its [`LICENSES.md`](https://github.com/trebeljahr/quaternius-showcase/blob/main/LICENSES.md)
lists each of the upstream packs as `CC0-1.0` and links back to the same
official pack pages above:

```md
| `animals_pack` | Ultimate Animated Animal Pack | CC0-1.0 | https://quaternius.com/packs/ultimateanimatedanimals.html |
| `crops_pack` | Ultimate Crops Pack | CC0-1.0 | https://quaternius.com/packs/ultimatecrops.html |
| `fantasy_real_time_strategy` | Ultimate Fantasy RTS | CC0-1.0 | https://quaternius.com/packs/ultimatefantasyrts.html |
| `medieval_village_pack` | Medieval Village Pack | CC0-1.0 | https://quaternius.com/packs/medievalvillage.html |
| `nature_pack` | Ultimate Nature Pack | CC0-1.0 | https://quaternius.com/packs/ultimatenature.html |
```

## What this means for the game

CC0 permits commercial use, modification and redistribution. Attribution is
not required (but the credits in the project list the source anyway).

The integration runs materials through a harmonisation pass (recolouring roofs
and other pieces) and normalises scale. These are derivatives of CC0 assets and
remain CC0. The game distributes the assets only as part of a completed game;
it does not repackage them as a standalone asset pack.

Representative file checksums (SHA-256) at integration time:

```text
5ad83a976c46d9dae887474343b0a7f39e215182ac25bd1f379e162278d92362  crops/Wheat_1.glb
8382f3d3b97e2338d2fd26190ddcc095d34d642d0e97105bda807ec87ccfd534  animals/Wolf.glb
697dbc949daa279858e3e4ebed1b3039137bfb9e5be97d783be323a7786dd27f  environment/WatchTower_FirstAge_Level1.glb
```
