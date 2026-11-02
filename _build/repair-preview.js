// Targeted, repeatable repairs for both freshly generated and existing V2 output.
// No files are deleted. The existing preview content and image assets stay intact.
const fs = require('fs');
const path = require('path');

function repair(out) {
  const read = name => fs.readFileSync(path.join(out, name), 'utf8');
  const write = (name, value) => fs.writeFileSync(path.join(out, name), value);
  // GitHub Pages/Jekyll otherwise omits the existing images/*/_thumb folders.
  write('.nojekyll', '');

  let home = read('index.html');
  home = home.replace(/\s*<div id="cookie-bar"[\s\S]*?<\/div>/, '');
  home = home.replace(/<aside class="side-feeds">[\s\S]*?<\/aside>/,
    fs.readFileSync(path.join(__dirname, 'social-panel.html'), 'utf8').trim());
  home = home.replace(/<script>\(function \(\) \{[\s\S]*?<\/script>/, '<script src="social.js" defer></script>');
  write('index.html', home);
  write('social.js', fs.readFileSync(path.join(__dirname, 'social.js'), 'utf8'));
  let css = read('style.css');
  css = css.replace(/\n\/\* Social consent repair \*\/[\s\S]*$/, '');
  css += '\n/* Social consent repair */\n' + fs.readFileSync(path.join(__dirname, 'social.css'), 'utf8');
  write('style.css', css);

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
    '<p>Die Startseite bietet optionale Inhalte von Facebook und Instagram. Erst wenn Sie „Facebook-Inhalte laden“ oder „Instagram-Inhalte laden“ auswählen, wird eine Verbindung zum jeweiligen Anbieter hergestellt. Dabei können unter anderem Ihre IP-Adresse und Browserdaten an Meta übermittelt und Cookies durch den Anbieter gesetzt werden. Wenn Sie dort angemeldet sind, kann Meta den Besuch Ihrem Konto zuordnen.</p>\n' +
    '<p>Ohne Aktivierung werden diese Inhalte nicht eingebettet. Ihre Auswahl wird von dieser Website nicht dauerhaft gespeichert. Mit „Einbettung schließen“ beenden Sie die Einbettung; bereits vom Anbieter gesetzte Cookies können Sie in Ihren Browsereinstellungen löschen. Alternativ können Sie die Profile über die direkten Links besuchen.</p>\n' +
    '<p>Informationen der Anbieter: <a href="https://www.facebook.com/privacy/policy/" target="_blank" rel="noopener noreferrer">Facebook-Datenschutz</a> und <a href="https://privacycenter.instagram.com/policy/" target="_blank" rel="noopener noreferrer">Instagram-Datenschutz</a>.</p>');
  write('impressum.html', legal);
}

module.exports = repair;
if (require.main === module) {
  if (!process.argv[2]) throw new Error('Usage: node repair-preview.js <existing output directory>');
  repair(path.resolve(process.argv[2]));
  console.log('Preview repairs applied.');
}
