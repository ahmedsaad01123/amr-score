// QR code generator using QRServer API (no JavaScript library needed).

export function drawQr(dom, qrcode, url) {
  const { h } = dom;
  const img = h("img", {
    src: `https://api.qrserver.com/v1/create-qr-code/?size=480x480&data=${encodeURIComponent(url)}&color=0f6f7c&bgcolor=ffffff`,
    alt: "QR Code",
    width: 480,
    height: 480,
  });
  return img;
}
