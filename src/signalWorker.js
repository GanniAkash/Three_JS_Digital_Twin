// signalWorker.js
// importScripts('overpass-api-client.js'); // if you need any helpers

onmessage = ({ data }) => {
    const { txPos, gridParams } = data;
    const { xPointCount, yPointCount, zPointCount, gridResolution, verticalResolution, x0, y0 } = gridParams;

    // allocate a flat Float32Array
    const flat = new Float32Array(xPointCount * yPointCount * zPointCount);
    let idx = 0;
    for (let yi = 0; yi < yPointCount; yi++) {
        const yVal = yi * verticalResolution + (verticalResolution / 2);
        if (yVal < 0) { idx += xPointCount * zPointCount; continue; }
        for (let xi = 0; xi < xPointCount; xi++) {
            const xVal = xi * gridResolution + (gridResolution / 2) + x0;
            for (let zi = 0; zi < zPointCount; zi++) {
                const zVal = zi * gridResolution + (gridResolution / 2) + y0;
                flat[idx] = UMApathLoss(txPos, { x: xVal, y: yVal, z: zVal });
                idx++;
            }
        }
    }
    postMessage({ flat });
};
