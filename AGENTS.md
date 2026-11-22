# Deploying this project

Do not add Tesla 3D models, official wrap templates, or extracted `vehicle.obj` files to git. They are downloaded at setup from their public upstreams.

The studio page at `preview/index.html` loads `/model/juniper/Bayberry.gltf`. Do not paste that mesh back into the HTML as a data URI.

## Setup

From the repository root:

```bash
bash scripts/setup.sh
cd preview && npm run dev
```

`scripts/setup.sh` installs npm packages, copies the Draco decoder out of `three`, then runs `scripts/fetch_assets.py`.

`fetch_assets.py` writes:

- `preview/public/model/{m3old,yold,m3,juniper}/` from `starbadboy/tesla`
- `assets/templates/<vehicle>/template.png` and `assets/template.png` from `teslamotors/custom-wraps`

Re-running the fetch is safe. Existing non-empty files are skipped.

## After setup

Studio preview: http://localhost:5173

Four-car switcher: http://localhost:5173/cars.html

Cars: 老款 Model 3, 老款 Model Y, 焕新 Model 3 (Highland), 焕新 Model Y (Juniper Premium).

Stencil a generated image onto the Premium template:

```bash
python3 pipeline/stencil.py path/to/art.png -n MyWrap
python3 pipeline/validate.py outputs/MyWrap.png
cp outputs/MyWrap.png preview/public/wraps/MyWrap.png
```

`stencil.py` only masks `modely-2025-premium`. Do not use that PNG on the other three cars.

## Do not commit

- `preview/public/model/`
- `preview/public/draco/`
- `preview/public/scene/`
- `assets/templates/`
- `assets/template.png`
- `assets/model/`
- `outputs/`
- `preview/node_modules/`
