// Targeted, repeatable repairs for both freshly generated and existing V2 output.
// No files are deleted. The existing preview content and image assets stay intact.
const fs = require('fs');
const path = require('path');

function repair(out) {
  const read = name => fs.readFileSync(path.join(out, name), 'utf8');
  const write = (name, value) => fs.writeFileSync(path.join(out, name), value);
  // GitHub Pages/Jekyll otherwise omits the existing images/*/_thumb folders.
  write('.nojekyll', '');

  // Facebook/Instagram retain the original direct embeds and tab behavior.

  let legal = read('impressum.html');
  legal = legal.replace(/\s*fax:\s*\+43 \(2236\) 2 99 50\s*<br\s*\/?\s*>/i, '');
  // EU Commission: the former ODR platform closed on 20 July 2025.
  // https://consumer-redress.ec.europa.eu/site-relocation_en
  legal = legal.replace(/<p><strong>EU-Streitschlichtung<\/strong><\/p>\s*<p>[\s\S]*?<\/p>/, '');
  legal = legal.replace(/<p><strong>Haftungsausschluss:<\/strong><\/p>[\s\S]*?(?=<p><strong>Datenschutzerklärung<\/strong>)/, '');
  legal = legal.replace(/<p><strong>Datenschutzerklärung<\/strong><\/p>\s*<p><strong>Datenschutz<\/strong><\/p>/, '');
  legal = legal.replace('verantworlich:', 'verantwortlich:').replace('kein Gewähr', 'keine Gewähr');
  legal = legal.replace(/<p><strong>Cookies<\/strong><\/p>[\s\S]*?<p><strong>Facebook Datenschutzerklärung<\/strong><\/p>[\s\S]*?<\/p>/,
    '<h3>Facebook, Instagram und Cookies</h3>\n' +
    "<p>Auf der Startseite sind Inhalte von Facebook und Instagram eingebunden. Facebook wird beim Aufruf der Startseite geladen, Instagram beim Wechsel zum Instagram-Reiter. Dabei können Ihre IP-Adresse und Browserdaten an Meta übermittelt und Cookies durch den Anbieter gesetzt werden. Wenn Sie dort angemeldet sind, kann Meta den Besuch Ihrem Konto zuordnen.</p>\n" +
    '<p>Informationen der Anbieter: <a href="https://www.facebook.com/privacy/policy/" target="_blank" rel="noopener noreferrer">Facebook-Datenschutz</a> und <a href="https://privacycenter.instagram.com/policy/" target="_blank" rel="noopener noreferrer">Instagram-Datenschutz</a>.</p>');
  write('impressum.html', legal);
}

module.exports = repair;
if (require.main === module) {
  if (!process.argv[2]) throw new Error('Usage: node repair-preview.js <existing output directory>');
  repair(path.resolve(process.argv[2]));
  console.log('Preview repairs applied.');
}
