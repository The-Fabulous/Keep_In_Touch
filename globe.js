const RAD = Math.PI / 180;
const clamp = (n, min, max) => Math.max(min, Math.min(max, n));

/** Orthographic globe: real land coordinates, projected locally on a 2D canvas. */
export class Globe {
  constructor(canvas, { decorative = false, onSelect = () => {}, onRotate = () => {} } = {}) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.decorative = decorative;
    this.onSelect = onSelect;
    this.onRotate = onRotate;
    this.longitude = decorative ? 25 : 45;
    this.latitude = 25;
    this.zoom = 1;
    this.people = [];
    this.dots = [];
    this.hitPoints = [];
    this.images = new Map();
    this.reducedMotion = matchMedia('(prefers-reduced-motion: reduce)');
    this.dirty = true;
    this.visible = false;
    this.observer = new ResizeObserver(() => this.resize());
    this.observer.observe(canvas);
    this.intersection = new IntersectionObserver(([entry]) => {
      this.visible = entry.isIntersecting;
      if (this.visible) this.start();
    });
    this.intersection.observe(canvas);
    document.addEventListener('visibilitychange', () => {
      if (!document.hidden) this.start();
    });
    if (!decorative) this.bindControls();
    this.resize();
  }

  async load() {
    const response = await fetch('./assets/land-dots.json');
    if (!response.ok) throw new Error('Не удалось загрузить карту');
    this.dots = await response.json();
    this.invalidate();
  }

  resize() {
    const { width, height } = this.canvas.getBoundingClientRect();
    this.width = width;
    this.height = height;
    const ratio = Math.min(devicePixelRatio || 1, 2);
    this.canvas.width = Math.round(width * ratio);
    this.canvas.height = Math.round(height * ratio);
    this.ctx.setTransform(ratio, 0, 0, ratio, 0, 0);
    this.invalidate();
  }

  setPeople(people, selected) {
    this.people = people;
    this.selected = selected;
    for (const person of people) {
      if (this.images.has(person.id)) continue;
      const img = new Image();
      img.onload = () => this.invalidate();
      img.src = person.avatar;
      this.images.set(person.id, img);
    }
    this.invalidate();
  }

  focus(person) {
    this.longitude = person.lon;
    this.latitude = clamp(person.lat - 8, -65, 65);
    this.selected = person.id;
    this.onRotate(this.latitude, this.longitude);
    this.invalidate();
  }

  changeZoom(delta) {
    this.zoom = clamp(this.zoom + delta, .72, 1.45);
    this.invalidate();
    return this.zoom;
  }

  reset() {
    this.longitude = 45;
    this.latitude = 25;
    this.zoom = 1;
    this.onRotate(this.latitude, this.longitude);
    this.invalidate();
  }

  bindControls() {
    this.canvas.addEventListener('pointerdown', event => {
      if (event.button !== 0) return;
      this.drag = { id: event.pointerId, x: event.clientX, y: event.clientY, startX: event.clientX, startY: event.clientY, moved: false };
      this.canvas.setPointerCapture(event.pointerId);
    });
    this.canvas.addEventListener('pointermove', event => {
      if (!this.drag || this.drag.id !== event.pointerId) return;
      const dx = event.clientX - this.drag.x;
      const dy = event.clientY - this.drag.y;
      this.longitude = ((this.longitude - dx * .3 + 540) % 360) - 180;
      this.latitude = clamp(this.latitude + dy * .25, -75, 75);
      this.drag.x = event.clientX;
      this.drag.y = event.clientY;
      if (Math.hypot(event.clientX - this.drag.startX, event.clientY - this.drag.startY) > 5) this.drag.moved = true;
      this.onRotate(this.latitude, this.longitude);
      this.invalidate();
    });
    this.canvas.addEventListener('pointerup', event => {
      if (!this.drag || this.drag.id !== event.pointerId) return;
      if (!this.drag.moved) {
        const rect = this.canvas.getBoundingClientRect();
        const hit = this.hitPoints.find(point => Math.hypot(event.clientX - rect.left - point.x, event.clientY - rect.top - point.y) < 23);
        if (hit) this.onSelect(hit.person);
      }
      this.drag = null;
    });
    this.canvas.addEventListener('pointercancel', () => { this.drag = null; });
    this.canvas.addEventListener('lostpointercapture', () => { this.drag = null; });
    this.canvas.addEventListener('keydown', event => {
      const key = event.key;
      if (!['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', '+', '=', '-', 'Home'].includes(key)) return;
      event.preventDefault();
      if (key === 'ArrowLeft') this.longitude -= 10;
      if (key === 'ArrowRight') this.longitude += 10;
      if (key === 'ArrowUp') this.latitude = clamp(this.latitude + 10, -75, 75);
      if (key === 'ArrowDown') this.latitude = clamp(this.latitude - 10, -75, 75);
      if (key === '+' || key === '=') this.changeZoom(.1);
      if (key === '-') this.changeZoom(-.1);
      if (key === 'Home') this.reset();
      this.longitude = ((this.longitude + 540) % 360) - 180;
      this.onRotate(this.latitude, this.longitude);
      this.invalidate();
    });
  }

  invalidate() { this.dirty = true; this.start(); }

  start() {
    if (this.frame || !this.visible || document.hidden) return;
    this.frame = requestAnimationFrame(time => this.tick(time));
  }

  tick(time) {
    this.frame = null;
    if (!this.visible || document.hidden || !this.width || !this.height) { this.lastTime = null; return; }
    const animate = this.decorative && !this.reducedMotion.matches;
    if (animate) {
      this.longitude += Math.min(time - (this.lastTime || time), 40) * .0025;
      this.dirty = true;
    }
    this.lastTime = time;
    if (this.dirty) { this.draw(); this.dirty = false; }
    if (animate) this.start();
  }

  project(lon, lat) {
    const a = (lon - this.longitude) * RAD;
    const b = lat * RAD;
    const tilt = this.latitude * RAD;
    const z = Math.sin(tilt) * Math.sin(b) + Math.cos(tilt) * Math.cos(b) * Math.cos(a);
    return {
      x: this.cx + this.radius * Math.cos(b) * Math.sin(a),
      y: this.cy - this.radius * (Math.cos(tilt) * Math.sin(b) - Math.sin(tilt) * Math.cos(b) * Math.cos(a)),
      z
    };
  }

  drawLine(coordinates) {
    const ctx = this.ctx;
    ctx.beginPath();
    let pen = false;
    for (const [lon, lat] of coordinates) {
      const p = this.project(lon, lat);
      if (p.z < 0) { pen = false; continue; }
      if (pen) ctx.lineTo(p.x, p.y); else ctx.moveTo(p.x, p.y);
      pen = true;
    }
    ctx.stroke();
  }

  draw() {
    const ctx = this.ctx;
    const { width, height } = this;
    ctx.clearRect(0, 0, width, height);
    this.radius = Math.min(width * .405, height * .405) * this.zoom;
    this.cx = width * (this.decorative ? .51 : .53);
    this.cy = height * (this.decorative ? .49 : .55);
    const { cx, cy, radius: r } = this;

    // Soft orbital rings and the globe's cast shadow.
    ctx.save();
    ctx.translate(cx, cy);
    ctx.rotate(-.3);
    ctx.strokeStyle = this.decorative ? '#bba9d326' : '#b1bb9b30';
    ctx.lineWidth = .8;
    ctx.beginPath();ctx.ellipse(0, 0, r * 1.23, r * .41, 0, 0, Math.PI * 2);ctx.stroke();
    ctx.restore();
    const shadow = ctx.createRadialGradient(cx, cy + r * .93, 0, cx, cy + r * .93, r * .65);
    shadow.addColorStop(0, '#71658216');shadow.addColorStop(1, '#71658200');
    ctx.save();ctx.translate(0, cy + r * .93);ctx.scale(1, .18);ctx.translate(0, -(cy + r * .93));
    ctx.fillStyle = shadow;ctx.fillRect(cx - r, cy, r * 2, r * 2);ctx.restore();

    const ocean = ctx.createRadialGradient(cx - r * .45, cy - r * .45, r * .05, cx + r * .05, cy, r * 1.05);
    ocean.addColorStop(0, '#faf8ff');ocean.addColorStop(.65, '#eee9f8');ocean.addColorStop(1, '#d9ccea');
    ctx.fillStyle = ocean;ctx.beginPath();ctx.arc(cx, cy, r, 0, Math.PI * 2);ctx.fill();
    ctx.save();ctx.beginPath();ctx.arc(cx, cy, r, 0, Math.PI * 2);ctx.clip();
    ctx.strokeStyle = '#aa92c223';ctx.lineWidth = .65;
    for (let lat = -60; lat <= 60; lat += 30) this.drawLine(Array.from({ length: 181 }, (_, i) => [i * 2 - 180, lat]));
    for (let lon = -180; lon < 180; lon += 30) this.drawLine(Array.from({ length: 91 }, (_, i) => [lon, i * 2 - 90]));
    for (const [lon, lat] of this.dots) {
      const p = this.project(lon, lat);
      if (p.z <= 0) continue;
      ctx.fillStyle = `rgba(143,114,178,${.3 + p.z * .43})`;
      ctx.beginPath();ctx.arc(p.x, p.y, Math.max(.45, r * .0062 * (.45 + .55 * p.z)), 0, Math.PI * 2);ctx.fill();
    }
    ctx.restore();
    ctx.strokeStyle = '#c1add84d';ctx.lineWidth = 1;ctx.beginPath();ctx.arc(cx, cy, r, 0, Math.PI * 2);ctx.stroke();
    this.hitPoints = [];
    const points = this.people.map(person => ({ person, ...this.project(person.lon, person.lat) })).filter(p => p.z > .12).sort((a, b) => a.z - b.z);
    for (const p of points) {
      const selected = p.person.id === this.selected;
      const size = selected ? 19 : 14;
      ctx.save();ctx.shadowColor = '#5e466f26';ctx.shadowBlur = 12;ctx.shadowOffsetY = 4;
      ctx.fillStyle = 'white';ctx.beginPath();ctx.arc(p.x, p.y, size + 3, 0, Math.PI * 2);ctx.fill();ctx.restore();
      if (selected) {ctx.strokeStyle = '#9574c9';ctx.lineWidth = 1.5;ctx.beginPath();ctx.arc(p.x, p.y, size + 6, 0, Math.PI * 2);ctx.stroke();}
      ctx.save();ctx.beginPath();ctx.arc(p.x, p.y, size, 0, Math.PI * 2);ctx.clip();
      const img = this.images.get(p.person.id);
      if (img?.complete && img.naturalWidth) ctx.drawImage(img, p.x - size, p.y - size, size * 2, size * 2);
      else {ctx.fillStyle = '#bda6db';ctx.fillRect(p.x-size,p.y-size,size*2,size*2);}
      ctx.restore();
      if (p.person.online) {ctx.fillStyle = '#92b16c';ctx.strokeStyle = '#fff';ctx.lineWidth = 2;ctx.beginPath();ctx.arc(p.x + size * .7, p.y + size * .7, 4, 0, Math.PI * 2);ctx.fill();ctx.stroke();}
      this.hitPoints.unshift(p);
    }
  }
}
