export const thumbHashMaxSide = 100;

type Average = { red: number; green: number; blue: number; alpha: number };
type Planes = { luminance: number[]; yellowBlue: number[]; redGreen: number[]; alpha: number[] };
type ChannelEncoding = { dc: number; ac: number[]; scale: number };

export function thumbHashFromRgba(
	width: number,
	height: number,
	rgba: ArrayLike<number>
): Uint8Array {
	if (width > thumbHashMaxSide || height > thumbHashMaxSide) {
		throw new RangeError(
			`${width}x${height} does not fit in ${thumbHashMaxSide}x${thumbHashMaxSide}`
		);
	}

	const pixelCount = width * height;
	const average = averageColor(rgba, pixelCount);
	const hasAlpha = average.alpha < pixelCount;
	const luminanceLimit = hasAlpha ? 5 : 7;
	const longest = Math.max(width, height);
	const luminanceX = Math.max(1, Math.round((luminanceLimit * width) / longest));
	const luminanceY = Math.max(1, Math.round((luminanceLimit * height) / longest));
	const planes = toPlanes(rgba, pixelCount, average);

	const encode = (plane: number[], columns: number, rows: number) =>
		encodeChannel(plane, width, height, columns, rows);
	const luminance = encode(planes.luminance, Math.max(3, luminanceX), Math.max(3, luminanceY));
	const yellowBlue = encode(planes.yellowBlue, 3, 3);
	const redGreen = encode(planes.redGreen, 3, 3);
	const alpha = hasAlpha ? encode(planes.alpha, 5, 5) : null;

	const isLandscape = width > height;
	const header24 =
		Math.round(63 * luminance.dc) |
		(Math.round(31.5 + 31.5 * yellowBlue.dc) << 6) |
		(Math.round(31.5 + 31.5 * redGreen.dc) << 12) |
		(Math.round(31 * luminance.scale) << 18) |
		(Number(hasAlpha) << 23);
	const header16 =
		(isLandscape ? luminanceY : luminanceX) |
		(Math.round(63 * yellowBlue.scale) << 3) |
		(Math.round(63 * redGreen.scale) << 9) |
		(Number(isLandscape) << 15);

	const header = [
		header24 & 255,
		(header24 >> 8) & 255,
		header24 >> 16,
		header16 & 255,
		header16 >> 8
	];
	if (alpha) header.push(Math.round(15 * alpha.dc) | (Math.round(15 * alpha.scale) << 4));

	const factors = [luminance, yellowBlue, redGreen, ...(alpha ? [alpha] : [])].flatMap(
		(channel) => channel.ac
	);
	const hash = new Uint8Array(header.length + Math.ceil(factors.length / 2));
	hash.set(header);
	factors.forEach((factor, index) => {
		hash[header.length + (index >> 1)] |= Math.round(15 * factor) << ((index & 1) << 2);
	});
	return hash;
}

function averageColor(rgba: ArrayLike<number>, pixelCount: number): Average {
	let red = 0;
	let green = 0;
	let blue = 0;
	let alpha = 0;
	for (let pixel = 0, offset = 0; pixel < pixelCount; pixel++, offset += 4) {
		const opacity = rgba[offset + 3] / 255;
		red += (opacity / 255) * rgba[offset];
		green += (opacity / 255) * rgba[offset + 1];
		blue += (opacity / 255) * rgba[offset + 2];
		alpha += opacity;
	}
	if (alpha > 0) {
		red /= alpha;
		green /= alpha;
		blue /= alpha;
	}
	return { red, green, blue, alpha };
}

function toPlanes(rgba: ArrayLike<number>, pixelCount: number, average: Average): Planes {
	const planes: Planes = { luminance: [], yellowBlue: [], redGreen: [], alpha: [] };
	for (let pixel = 0, offset = 0; pixel < pixelCount; pixel++, offset += 4) {
		const opacity = rgba[offset + 3] / 255;
		const red = average.red * (1 - opacity) + (opacity / 255) * rgba[offset];
		const green = average.green * (1 - opacity) + (opacity / 255) * rgba[offset + 1];
		const blue = average.blue * (1 - opacity) + (opacity / 255) * rgba[offset + 2];
		planes.luminance[pixel] = (red + green + blue) / 3;
		planes.yellowBlue[pixel] = (red + green) / 2 - blue;
		planes.redGreen[pixel] = red - green;
		planes.alpha[pixel] = opacity;
	}
	return planes;
}

function encodeChannel(
	plane: number[],
	width: number,
	height: number,
	columns: number,
	rows: number
): ChannelEncoding {
	let dc = 0;
	let scale = 0;
	const ac: number[] = [];
	const horizontal = new Array<number>(width);
	for (let cy = 0; cy < rows; cy++) {
		for (let cx = 0; cx * rows < columns * (rows - cy); cx++) {
			for (let x = 0; x < width; x++) horizontal[x] = Math.cos((Math.PI / width) * cx * (x + 0.5));
			let factor = 0;
			for (let y = 0; y < height; y++) {
				const vertical = Math.cos((Math.PI / height) * cy * (y + 0.5));
				for (let x = 0; x < width; x++) factor += plane[x + y * width] * horizontal[x] * vertical;
			}
			factor /= width * height;
			if (cx > 0 || cy > 0) {
				ac.push(factor);
				scale = Math.max(scale, Math.abs(factor));
			} else {
				dc = factor;
			}
		}
	}
	if (scale > 0) {
		for (let index = 0; index < ac.length; index++) ac[index] = 0.5 + (0.5 / scale) * ac[index];
	}
	return { dc, ac, scale };
}

export type DecodedThumbHash = { width: number; height: number; rgba: Uint8Array };

const decodedLongestSide = 32;

export function thumbHashToRgba(hash: Uint8Array): DecodedThumbHash {
	const header24 = hash[0] | (hash[1] << 8) | (hash[2] << 16);
	const header16 = hash[3] | (hash[4] << 8);
	const luminanceDc = (header24 & 63) / 63;
	const yellowBlueDc = ((header24 >> 6) & 63) / 31.5 - 1;
	const redGreenDc = ((header24 >> 12) & 63) / 31.5 - 1;
	const luminanceScale = ((header24 >> 18) & 31) / 31;
	const hasAlpha = header24 >> 23 !== 0;
	const yellowBlueScale = ((header16 >> 3) & 63) / 63;
	const redGreenScale = ((header16 >> 9) & 63) / 63;
	const isLandscape = header16 >> 15 !== 0;
	const luminanceLimit = hasAlpha ? 5 : 7;
	const columns = Math.max(3, isLandscape ? luminanceLimit : header16 & 7);
	const rows = Math.max(3, isLandscape ? header16 & 7 : luminanceLimit);
	const alphaDc = hasAlpha ? (hash[5] & 15) / 15 : 1;
	const alphaScale = (hash[5] >> 4) / 15;

	const factorStart = hasAlpha ? 6 : 5;
	let factorIndex = 0;
	const readChannel = (channelColumns: number, channelRows: number, scale: number) => {
		const ac: number[] = [];
		for (let cy = 0; cy < channelRows; cy++) {
			for (let cx = cy ? 0 : 1; cx * channelRows < channelColumns * (channelRows - cy); cx++) {
				const nibble = (hash[factorStart + (factorIndex >> 1)] >> ((factorIndex & 1) << 2)) & 15;
				factorIndex++;
				ac.push((nibble / 7.5 - 1) * scale);
			}
		}
		return ac;
	};
	const luminance = readChannel(columns, rows, luminanceScale);
	const yellowBlue = readChannel(3, 3, yellowBlueScale * 1.25);
	const redGreen = readChannel(3, 3, redGreenScale * 1.25);
	const alpha = hasAlpha ? readChannel(5, 5, alphaScale) : [];

	const ratio = approximateAspectRatio(hash);
	const width = Math.round(ratio > 1 ? decodedLongestSide : decodedLongestSide * ratio);
	const height = Math.round(ratio > 1 ? decodedLongestSide / ratio : decodedLongestSide);
	const rgba = new Uint8Array(width * height * 4);
	const horizontal: number[] = [];
	const vertical: number[] = [];
	const horizontalCount = Math.max(columns, hasAlpha ? 5 : 3);
	const verticalCount = Math.max(rows, hasAlpha ? 5 : 3);

	for (let y = 0, offset = 0; y < height; y++) {
		for (let x = 0; x < width; x++, offset += 4) {
			let l = luminanceDc;
			let p = yellowBlueDc;
			let q = redGreenDc;
			let a = alphaDc;
			for (let cx = 0; cx < horizontalCount; cx++) {
				horizontal[cx] = Math.cos((Math.PI / width) * (x + 0.5) * cx);
			}
			for (let cy = 0; cy < verticalCount; cy++) {
				vertical[cy] = Math.cos((Math.PI / height) * (y + 0.5) * cy);
			}
			for (let cy = 0, j = 0; cy < rows; cy++) {
				const doubled = vertical[cy] * 2;
				for (let cx = cy ? 0 : 1; cx * rows < columns * (rows - cy); cx++, j++) {
					l += luminance[j] * horizontal[cx] * doubled;
				}
			}
			for (let cy = 0, j = 0; cy < 3; cy++) {
				const doubled = vertical[cy] * 2;
				for (let cx = cy ? 0 : 1; cx < 3 - cy; cx++, j++) {
					const factor = horizontal[cx] * doubled;
					p += yellowBlue[j] * factor;
					q += redGreen[j] * factor;
				}
			}
			if (hasAlpha) {
				for (let cy = 0, j = 0; cy < 5; cy++) {
					const doubled = vertical[cy] * 2;
					for (let cx = cy ? 0 : 1; cx < 5 - cy; cx++, j++) {
						a += alpha[j] * horizontal[cx] * doubled;
					}
				}
			}
			const blue = l - (2 / 3) * p;
			const red = (3 * l - blue + q) / 2;
			const green = red - q;
			rgba[offset] = Math.max(0, 255 * Math.min(1, red));
			rgba[offset + 1] = Math.max(0, 255 * Math.min(1, green));
			rgba[offset + 2] = Math.max(0, 255 * Math.min(1, blue));
			rgba[offset + 3] = Math.max(0, 255 * Math.min(1, a));
		}
	}
	return { width, height, rgba };
}

function approximateAspectRatio(hash: Uint8Array): number {
	const hasAlpha = (hash[2] & 0x80) !== 0;
	const isLandscape = (hash[4] & 0x80) !== 0;
	const luminanceLimit = hasAlpha ? 5 : 7;
	const columns = isLandscape ? luminanceLimit : hash[3] & 7;
	const rows = isLandscape ? hash[3] & 7 : luminanceLimit;
	return columns / rows;
}
