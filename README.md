# openPDF

[English](#english) · [Français](#français)

---

## English

**openPDF** is a free, open-source PDF editor that runs entirely in your web browser.

### 🔒 Your files never leave your computer

- **Nothing is uploaded.** Your PDF is opened and edited locally, in your browser. There is no server, no account and no backend.
- **Nothing is saved unless you ask.** No copy of your documents is stored on a server. The only things kept in your browser's storage are your language choice and the edits of the projects you explicitly save with **Save** (Ctrl+S), never the PDFs themselves. Otherwise, closing or reloading the page discards everything (the browser asks for confirmation if you have unsaved changes).
- **No tracking.** No analytics, no cookies.
- The only network requests load the two open-source libraries ([pdf.js](https://mozilla.github.io/pdf.js/) and [pdf-lib](https://pdf-lib.js.org/)) from public CDNs. Your documents are never sent.

👉 Remember to click **Download** to keep your edited PDF.

### Features

- **Add content**: text (Helvetica, Times, Courier; multi-line), images (PNG/JPEG), hand-drawn signature, freehand drawing, rectangles, highlights, and white boxes to hide existing content.
- **Edit existing text**: click a line of text in the PDF with the *Edit* tool; it is covered by a white box and replaced by editable text.
- **Edit elements**: select, move (including to another page), resize, recolor, delete. Copy/paste with Ctrl+C / Ctrl+V.
- **Manage pages**: reorder by drag and drop in the sidebar, rotate, delete, insert a blank page, merge another PDF.
- **Undo / redo** (Ctrl+Z / Ctrl+Y).
- **Saves**: **Save** (Ctrl+S) stores your edits (not the PDF itself) in your browser's local storage; several saves can coexist. The PDFs are recognised by a fingerprint, not by name. When you open a PDF that has a save, openPDF *offers* to restore it (never automatically). **Saves…** lists every save so you can restore it (you re-select the original PDF(s)) or delete it.
- **Ribbon menus** (File, Edit, Insert, Page) and **English / French** interface (more languages: add a block in `i18n.js`).
- **Flattened export**: your additions are written into the page content, and existing form fields are flattened, so the downloaded PDF can't be changed by accident.

### Keyboard shortcuts

| Key | Action |
|---|---|
| V / T / E / H / R / W / D | Select / Text / Edit existing text / Highlight / Rectangle / White box / Draw |
| Double-click | Edit a text element |
| Delete | Delete selected element |
| Ctrl+C / Ctrl+V | Copy / paste |
| Ctrl+Z / Ctrl+Y | Undo / redo |
| Ctrl+S | Save the project |
| Esc | Deselect |

### Limitations

- Editing existing text is a cover-and-replace: the replacement uses a standard font (Helvetica, Times or Courier) in black, and the white box assumes a white background.
- The built-in fonts only support Latin characters. Other characters are replaced with `?` in the export.

### Run locally

It's a static site with no build step. Serve the folder with any web server, for example:

```bash
python -m http.server 8123
```

Then open http://localhost:8123.

---

## Français

**openPDF** est un éditeur PDF gratuit et open source qui fonctionne entièrement dans votre navigateur.

### 🔒 Vos fichiers ne quittent jamais votre ordinateur

- **Rien n'est envoyé.** Votre PDF est ouvert et modifié localement, dans votre navigateur. Il n'y a ni serveur, ni compte, ni backend.
- **Rien n'est sauvegardé sans votre demande.** Aucune copie de vos documents n'est conservée sur un serveur. Seuls votre choix de langue et les modifications des projets que vous sauvegardez explicitement avec **Sauvegarder** (Ctrl+S) sont gardés dans le stockage du navigateur, jamais les PDF eux-mêmes. Sinon, fermer ou recharger la page efface tout (le navigateur demande confirmation s'il y a des modifications non exportées).
- **Aucun suivi.** Pas de statistiques, pas de cookies.
- Les seules requêtes réseau chargent les deux bibliothèques open source ([pdf.js](https://mozilla.github.io/pdf.js/) et [pdf-lib](https://pdf-lib.js.org/)) depuis des CDN publics. Vos documents ne sont jamais transmis.

👉 Pensez à cliquer sur **Télécharger** pour garder votre PDF modifié.

### Fonctionnalités

- **Ajouter du contenu** : texte (Helvetica, Times, Courier ; multiligne), images (PNG/JPEG), signature dessinée, dessin à main levée, rectangles, surlignage et caches blancs pour masquer du contenu existant.
- **Modifier le texte existant** : cliquez sur une ligne du PDF avec l'outil *Éditer* ; elle est masquée par un cache blanc et remplacée par un texte modifiable.
- **Modifier les éléments** : sélectionner, déplacer (y compris vers une autre page), redimensionner, changer la couleur, supprimer. Copier/coller avec Ctrl+C / Ctrl+V.
- **Gérer les pages** : réordonner par glisser-déposer dans la barre latérale, pivoter, supprimer, insérer une page blanche, fusionner un autre PDF.
- **Annuler / rétablir** (Ctrl+Z / Ctrl+Y).
- **Sauvegardes** : **Sauvegarder** (Ctrl+S) enregistre vos modifications (pas le PDF lui-même) dans le stockage local du navigateur ; plusieurs sauvegardes peuvent coexister. Les PDF sont reconnus par une empreinte, pas par leur nom. Quand vous ouvrez un PDF qui a une sauvegarde, openPDF vous *propose* de la restaurer (jamais automatiquement). **Sauvegardes…** liste toutes les sauvegardes pour les restaurer (vous resélectionnez le(s) PDF d'origine) ou les supprimer.
- **Menus en ruban** (Fichier, Édition, Insertion, Page) et interface **français / anglais** (autres langues : ajouter un bloc dans `i18n.js`).
- **Export aplati** : vos ajouts sont intégrés au contenu des pages et les champs de formulaire existants sont aplatis, pour que le PDF téléchargé ne puisse pas être modifié par erreur.

### Raccourcis clavier

| Touche | Action |
|---|---|
| V / T / E / H / R / W / D | Sélection / Texte / Éditer le texte existant / Surligner / Rectangle / Blanc / Dessin |
| Double-clic | Modifier un texte |
| Suppr | Supprimer l'élément sélectionné |
| Ctrl+C / Ctrl+V | Copier / coller |
| Ctrl+Z / Ctrl+Y | Annuler / rétablir |
| Ctrl+S | Sauvegarder le projet |
| Échap | Désélectionner |

### Limites

- L'édition du texte existant fonctionne par masquage et remplacement : le nouveau texte utilise une police standard (Helvetica, Times ou Courier) en noir, et le cache blanc suppose un fond blanc.
- Les polices intégrées ne gèrent que les caractères latins. Les autres caractères sont remplacés par `?` à l'export.

### Lancer en local

C'est un site statique, sans étape de build. Servez le dossier avec n'importe quel serveur web, par exemple :

```bash
python -m http.server 8123
```

Puis ouvrez http://localhost:8123.

---

## LIVE DEMO

https://madagaga.github.io/openPDF/

---

## License / Licence

pdf.js – Apache-2.0 · pdf-lib – MIT
