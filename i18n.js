// Traductions. Pour ajouter une langue : copier un bloc, traduire les valeurs, c'est tout
// (la clé 'lang.name' alimente le sélecteur de langue). Le français sert de repli.
// HTML : data-i18n="clé" (texte) et data-i18n-title="clé" (infobulle). JS : tr('clé', arg0, …) avec {0}, {1}…

const I18N = {
  fr: {
    'lang.name': 'Français',
    'app.title': 'openPDF – Éditeur PDF',
    'lang.label': 'Langue',

    'tab.file': 'Fichier', 'tab.edit': 'Édition', 'tab.insert': 'Insertion', 'tab.page': 'Page',
    'g.document': 'Document', 'g.project': 'Projet', 'g.tools': 'Outils', 'g.shapes': 'Texte et formes',
    'g.drawing': 'Dessin', 'g.image': 'Image', 'g.pages': 'Page courante', 'g.props': 'Propriétés', 'g.export': 'Export',

    'btn.open': 'Ouvrir', 'btn.merge': 'Ajouter PDF', 'btn.save': 'Sauvegarder', 'btn.saves': 'Sauvegardes…',
    'btn.download': 'Télécharger',
    'tip.download': 'Télécharger le PDF modifié', 'tip.open': 'Ouvrir un PDF', 'tip.merge': 'Ajouter les pages d’un autre PDF',
    'tip.save': 'Sauvegarder le projet dans le navigateur (Ctrl+S)',
    'tip.saves': 'Voir, restaurer ou supprimer les sauvegardes',
    'tip.undo': 'Annuler (Ctrl+Z)', 'tip.redo': 'Rétablir (Ctrl+Y)',
    'tip.zoomOut': 'Zoom arrière', 'tip.zoomIn': 'Zoom avant',

    'tool.select': 'Sélection', 'tool.edit': 'Éditer le texte', 'tool.text': 'Texte', 'tool.highlight': 'Surligner',
    'tool.rect': 'Rectangle', 'tool.whiteout': 'Blanc', 'tool.ink': 'Dessin', 'tool.image': 'Image', 'tool.sign': 'Signature',
    'tip.select': 'Sélection (V)', 'tip.edit': 'Éditer le texte existant (E)', 'tip.text': 'Texte (T)',
    'tip.highlight': 'Surligner (H)', 'tip.rect': 'Rectangle (R)', 'tip.whiteout': 'Masquer (W)',
    'tip.ink': 'Dessin (D)', 'tip.image': 'Insérer une image', 'tip.sign': 'Signature',

    'page.blank': 'Page blanche', 'page.rotL': 'Pivoter à gauche', 'page.rotR': 'Pivoter à droite', 'page.delete': 'Supprimer',
    'tip.pageBlank': 'Insérer une page blanche après la page courante',

    'prop.color': 'Couleur', 'prop.font': 'Police', 'prop.size': 'Taille du texte', 'prop.width': 'Épaisseur du trait',

    'drop.title': 'Glisse un PDF ici', 'drop.choose': 'Choisir un fichier',
    'drop.hint': 'Tout reste dans ton navigateur : aucun fichier n’est envoyé.',

    'sign.title': 'Dessine ta signature', 'sign.clear': 'Effacer', 'sign.cancel': 'Annuler', 'sign.ok': 'Placer',

    'export.busy': 'Export…', 'export.fail': 'Échec de l’export : {0}',

    'save.ok': 'Sauvegardé ✓',
    'save.fail': 'Sauvegarde impossible : le stockage du navigateur est plein ou indisponible (trop d’images ajoutées ?). Utilisez « Télécharger » pour conserver votre travail.',

    'restore.confirm': 'Remplacer le travail en cours par le projet sauvegardé ?',
    'restore.missing': 'Restauration annulée : fichier(s) introuvable(s) ou différent(s) de l’original :\n• {0}',
    'restore.fail': 'Restauration impossible : {0}',

    'saves.title': 'Sauvegardes du navigateur',
    'saves.intro': 'Seules vos modifications sont sauvegardées, pas les PDF : pour restaurer, vous resélectionnez les mêmes fichiers.',
    'saves.empty': 'Aucune sauvegarde.',
    'saves.restore': 'Restaurer', 'saves.delete': 'Supprimer', 'saves.deleteAll': 'Tout supprimer', 'saves.close': 'Fermer',
    'saves.confirmDeleteAll': 'Supprimer toutes les sauvegardes ?',
    'saves.meta': 'Sauvegardé le {0} · {1} page(s) · {2} annotation(s)',
    'saves.pdfs': 'PDF à resélectionner : {0}',
    'saves.noPdfs': 'Aucun PDF à resélectionner',

    'bar.found': 'Une sauvegarde existe pour ce PDF ({0}).',
    'bar.restore': 'Restaurer', 'bar.ignore': 'Ignorer',
  },

  en: {
    'lang.name': 'English',
    'app.title': 'openPDF – PDF editor',
    'lang.label': 'Language',

    'tab.file': 'File', 'tab.edit': 'Edit', 'tab.insert': 'Insert', 'tab.page': 'Page',
    'g.document': 'Document', 'g.project': 'Project', 'g.tools': 'Tools', 'g.shapes': 'Text and shapes',
    'g.drawing': 'Drawing', 'g.image': 'Image', 'g.pages': 'Current page', 'g.props': 'Properties', 'g.export': 'Export',

    'btn.open': 'Open', 'btn.merge': 'Add PDF', 'btn.save': 'Save', 'btn.saves': 'Saves…',
    'btn.download': 'Download',
    'tip.download': 'Download the edited PDF', 'tip.open': 'Open a PDF', 'tip.merge': 'Add the pages of another PDF',
    'tip.save': 'Save the project in the browser (Ctrl+S)',
    'tip.saves': 'View, restore or delete saves',
    'tip.undo': 'Undo (Ctrl+Z)', 'tip.redo': 'Redo (Ctrl+Y)',
    'tip.zoomOut': 'Zoom out', 'tip.zoomIn': 'Zoom in',

    'tool.select': 'Select', 'tool.edit': 'Edit text', 'tool.text': 'Text', 'tool.highlight': 'Highlight',
    'tool.rect': 'Rectangle', 'tool.whiteout': 'White box', 'tool.ink': 'Draw', 'tool.image': 'Image', 'tool.sign': 'Signature',
    'tip.select': 'Select (V)', 'tip.edit': 'Edit existing text (E)', 'tip.text': 'Text (T)',
    'tip.highlight': 'Highlight (H)', 'tip.rect': 'Rectangle (R)', 'tip.whiteout': 'Hide content (W)',
    'tip.ink': 'Draw (D)', 'tip.image': 'Insert an image', 'tip.sign': 'Signature',

    'page.blank': 'Blank page', 'page.rotL': 'Rotate left', 'page.rotR': 'Rotate right', 'page.delete': 'Delete',
    'tip.pageBlank': 'Insert a blank page after the current page',

    'prop.color': 'Color', 'prop.font': 'Font', 'prop.size': 'Text size', 'prop.width': 'Line width',

    'drop.title': 'Drop a PDF here', 'drop.choose': 'Choose a file',
    'drop.hint': 'Everything stays in your browser: no file is uploaded.',

    'sign.title': 'Draw your signature', 'sign.clear': 'Clear', 'sign.cancel': 'Cancel', 'sign.ok': 'Place',

    'export.busy': 'Exporting…', 'export.fail': 'Export failed: {0}',

    'save.ok': 'Saved ✓',
    'save.fail': 'Save failed: browser storage is full or unavailable (too many images added?). Use “Download” to keep your work.',

    'restore.confirm': 'Replace the current work with the saved project?',
    'restore.missing': 'Restore cancelled: file(s) missing or different from the original:\n• {0}',
    'restore.fail': 'Restore failed: {0}',

    'saves.title': 'Browser saves',
    'saves.intro': 'Only your edits are saved, not the PDFs: to restore, you re-select the same files.',
    'saves.empty': 'No saves.',
    'saves.restore': 'Restore', 'saves.delete': 'Delete', 'saves.deleteAll': 'Delete all', 'saves.close': 'Close',
    'saves.confirmDeleteAll': 'Delete all saves?',
    'saves.meta': 'Saved on {0} · {1} page(s) · {2} annotation(s)',
    'saves.pdfs': 'PDF(s) to re-select: {0}',
    'saves.noPdfs': 'No PDF to re-select',

    'bar.found': 'A save exists for this PDF ({0}).',
    'bar.restore': 'Restore', 'bar.ignore': 'Ignore',
  },
};

const LANG_KEY = 'openpdf-lang';
let lang = 'fr';
try {
  const saved = localStorage.getItem(LANG_KEY);
  lang = I18N[saved] ? saved : (navigator.language || '').toLowerCase().startsWith('fr') ? 'fr' : 'en';
} catch { lang = (navigator.language || '').toLowerCase().startsWith('fr') ? 'fr' : 'en'; }

function tr(key, ...args) {
  const s = (I18N[lang] && I18N[lang][key]) ?? I18N.fr[key] ?? key;
  return s.replace(/\{(\d+)\}/g, (_, i) => args[i]);
}

function applyI18n() {
  document.documentElement.lang = lang;
  document.title = tr('app.title');
  document.querySelectorAll('[data-i18n]').forEach(el => { el.textContent = tr(el.dataset.i18n); });
  document.querySelectorAll('[data-i18n-title]').forEach(el => { el.title = tr(el.dataset.i18nTitle); });
}

function setLang(l) {
  if (!I18N[l]) return;
  lang = l;
  try { localStorage.setItem(LANG_KEY, l); } catch { /* stockage indisponible : le choix vaut pour la session */ }
  applyI18n();
}
