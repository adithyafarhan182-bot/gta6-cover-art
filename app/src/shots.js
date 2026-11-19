// Fixed scenes for screenshots: ?shot=editor shows the editor with sample
// photos loaded; ?shot=cover shows the finished cover alone, full-bleed.
// Query knobs: layout, grade, title, subtitle, size, photo1, photo2, photo3.
// window.__shotReady is set once the scene is painted.
export async function runShot(shot, query, setup) {
  const patch = {
    layout: query.get('layout') || 'poster',
    grade: query.get('grade') || 'sunset',
    title: query.get('title') || 'VICE NIGHTS',
    subtitle: query.get('subtitle') || 'SUNSET HEIST',
    sizeKey: query.get('size') || 'square',
    photos: [
      query.get('photo1') || 'boulevard',
      query.get('photo2') || 'pier',
      query.get('photo3') || 'boulevard',
    ],
  };
  if (shot === 'cover') {
    document.body.classList.add('shot-cover');
    const canvas = document.getElementById('cover');
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
  }
  await setup(patch);
  if (document.fonts) {
    try {
      await document.fonts.load('100px Anton');
      await document.fonts.ready;
    } catch {
      // Anton missing: the canvas falls back to a bold sans.
    }
  }
  await new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)));
  window.__shotReady = true;
  document.title = 'shot-ready';
}
