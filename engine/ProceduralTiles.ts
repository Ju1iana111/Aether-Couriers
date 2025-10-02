const TILE_SIZE = 32;

// FIX: Changed CanvasRenderingContext2D to OffscreenCanvasRenderingContext2D to match the context from OffscreenCanvas.
type DrawFunction = (ctx: OffscreenCanvasRenderingContext2D) => void;

const drawGround: DrawFunction = (ctx) => {
    ctx.fillStyle = '#3a4a34'; // Dark grass green
    ctx.fillRect(0, 0, TILE_SIZE, TILE_SIZE);

    for (let i = 0; i < 40; i++) {
        const x = Math.random() * TILE_SIZE;
        const y = Math.random() * TILE_SIZE;
        ctx.fillStyle = Math.random() > 0.5 ? '#4a5a44' : '#2a3a24';
        ctx.fillRect(x, y, 2, 2);
    }
};

const drawStone: DrawFunction = (ctx) => {
    ctx.fillStyle = '#6b7280'; // gray-500
    ctx.fillRect(0, 0, TILE_SIZE, TILE_SIZE);
    
    // Border
    ctx.strokeStyle = '#4b5563'; // gray-700
    ctx.lineWidth = 2;
    ctx.strokeRect(1, 1, TILE_SIZE - 2, TILE_SIZE - 2);

    // Cracks
    ctx.strokeStyle = '#52525b'; // gray-600
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(5, TILE_SIZE);
    ctx.lineTo(12, 20);
    ctx.lineTo(22, 25);
    ctx.moveTo(20, 0);
    ctx.lineTo(25, 10);
    ctx.stroke();
};

const drawStart: DrawFunction = (ctx) => {
    ctx.fillStyle = '#1f2937'; // gray-800
    ctx.fillRect(0, 0, TILE_SIZE, TILE_SIZE);
    
    // Glowing grid
    ctx.strokeStyle = '#38bdf8'; // sky-400
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.rect(4, 4, TILE_SIZE - 8, TILE_SIZE - 8);
    ctx.moveTo(4, TILE_SIZE / 2);
    ctx.lineTo(TILE_SIZE - 4, TILE_SIZE / 2);
    ctx.moveTo(TILE_SIZE / 2, 4);
    ctx.lineTo(TILE_SIZE / 2, TILE_SIZE - 4);
    ctx.stroke();

    // Center light
    ctx.fillStyle = '#7dd3fc'; // sky-300
    ctx.fillRect(TILE_SIZE/2 - 3, TILE_SIZE/2 - 3, 6, 6);
};

const drawPortal: DrawFunction = (ctx) => {
    ctx.fillStyle = '#1e1b4b'; // indigo-950
    ctx.fillRect(0, 0, TILE_SIZE, TILE_SIZE);

    // Concentric glowing rings
    for (let r = TILE_SIZE / 2 - 2; r > 2; r -= 3) {
        const alpha = 1 - (r / (TILE_SIZE / 2));
        ctx.strokeStyle = `rgba(167, 139, 250, ${alpha * 0.8})`; // violet-400
        ctx.lineWidth = 2.5;
        ctx.beginPath();
        ctx.arc(TILE_SIZE / 2, TILE_SIZE / 2, r, 0, Math.PI * 2);
        ctx.stroke();
    }
};

const drawPit: DrawFunction = (ctx) => {
    // A starry void
    ctx.fillStyle = '#020617'; // slate-950
    ctx.fillRect(0, 0, TILE_SIZE, TILE_SIZE);

    for (let i = 0; i < 20; i++) {
        const x = Math.random() * TILE_SIZE;
        const y = Math.random() * TILE_SIZE;
        const radius = Math.random() * 1.5;
        // Stars of different colors and brightness
        const r = Math.floor(Math.random() * 55 + 200);
        const g = Math.floor(Math.random() * 55 + 200);
        const b = 255;
        const a = Math.random() * 0.8 + 0.2;
        ctx.fillStyle = `rgba(${r},${g},${b},${a})`;
        
        ctx.beginPath();
        ctx.arc(x, y, radius, 0, Math.PI * 2);
        ctx.fill();
    }
};

const tileDrawers: Record<string, DrawFunction> = {
    ground: drawGround,
    stone: drawStone,
    start: drawStart,
    portal: drawPortal,
    pit: drawPit,
};

async function generateSprite(drawFn: DrawFunction): Promise<ImageBitmap> {
    const canvas = new OffscreenCanvas(TILE_SIZE, TILE_SIZE);
    const ctx = canvas.getContext('2d')!;
    drawFn(ctx);
    return await canvas.transferToImageBitmap();
}

export async function generateTileCache(): Promise<Map<string, ImageBitmap>> {
    const cache = new Map<string, ImageBitmap>();
    
    const promises = Object.entries(tileDrawers).map(async ([name, drawer]) => {
        const sprite = await generateSprite(drawer);
        cache.set(name, sprite);
    });

    await Promise.all(promises);
    return cache;
}