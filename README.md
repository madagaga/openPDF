# openPDF

[English](#english) · [Français](#français)

---

## English

**openPDF** is a free, open-source PDF editor that runs entirely in your web browser.

### 🔒 Your files never leave your computer

- **Nothing is uploaded.** Your PDF is opened and edited locally, in your browser. There is no server, no account and no backend.
- **Nothing is saved.** No copy of your documents is stored anywhere: not on a server, not in your browser's storage. Closing or reloading the page discards everything.
- **No tracking.** No analytics, no cookies.
- The only network requests load the two open-source libraries ([pdf.js](https://mozilla.github.io/pdf.js/) and [pdf-lib](https://pdf-lib.js.org/)) from public CDNs. Your documents are never sent.

👉 Remember to click **Download** to keep your edited PDF.

### Features

- **Add content**: text (Helvetica, Times, Courier; multi-line), images (PNG/JPEG), hand-drawn signature, freehand drawing, rectangles, highlights, and white boxes to hide existing content.
- **Edit elements**: select, move (including to another page), resize, recolor, delete. Copy/paste with Ctrl+C / Ctrl+V.
- **Manage pages**: reorder by drag and drop in the sidebar, rotate, delete, insert a blank page, merge another PDF.
- **Undo / redo** (Ctrl+Z / Ctrl+Y).
- **Flattened export**: your additions are written into the page content, and existing form fields are flattened, so the downloaded PDF can't be changed by accident.

### Keyboard shortcuts

| Key | Action |
|---|---|
| V / T / H / R / W / D | Select / Text / Highlight / Rectangle / White box / Draw |
| Double-click | Edit a text element |
| Delete | Delete selected element |
| Ctrl+C / Ctrl+V | Copy / paste |
| Ctrl+Z / Ctrl+Y | Undo / redo |
| Esc | Deselect |

### Limitations

- Existing text in the PDF can't be edited directly: cover it with a white box, then add new text on top.
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
- **Rien n'est sauvegardé.** Aucune copie de vos documents n'est conservée, ni sur un serveur, ni dans le stockage du navigateur. Fermer ou recharger la page efface tout.
- **Aucun suivi.** Pas de statistiques, pas de cookies.
- Les seules requêtes réseau chargent les deux bibliothèques open source ([pdf.js](https://mozilla.github.io/pdf.js/) et [pdf-lib](https://pdf-lib.js.org/)) depuis des CDN publics. Vos documents ne sont jamais transmis.

👉 Pensez à cliquer sur **Télécharger** pour garder votre PDF modifié.

### Fonctionnalités

- **Ajouter du contenu** : texte (Helvetica, Times, Courier ; multiligne), images (PNG/JPEG), signature dessinée, dessin à main levée, rectangles, surlignage et caches blancs pour masquer du contenu existant.
- **Modifier les éléments** : sélectionner, déplacer (y compris vers une autre page), redimensionner, changer la couleur, supprimer. Copier/coller avec Ctrl+C / Ctrl+V.
- **Gérer les pages** : réordonner par glisser-déposer dans la barre latérale, pivoter, supprimer, insérer une page blanche, fusionner un autre PDF.
- **Annuler / rétablir** (Ctrl+Z / Ctrl+Y).
- **Export aplati** : vos ajouts sont intégrés au contenu des pages et les champs de formulaire existants sont aplatis, pour que le PDF téléchargé ne puisse pas être modifié par erreur.

### Raccourcis clavier

| Touche | Action |
|---|---|
| V / T / H / R / W / D | Sélection / Texte / Surligner / Rectangle / Blanc / Dessin |
| Double-clic | Modifier un texte |
| Suppr | Supprimer l'élément sélectionné |
| Ctrl+C / Ctrl+V | Copier / coller |
| Ctrl+Z / Ctrl+Y | Annuler / rétablir |
| Échap | Désélectionner |

### Limites

- Le texte déjà présent dans le PDF ne peut pas être modifié directement : masquez-le avec un cache blanc, puis ajoutez le nouveau texte par-dessus.
- Les polices intégrées ne gèrent que les caractères latins. Les autres caractères sont remplacés par `?` à l'export.

### Lancer en local

C'est un site statique, sans étape de build. Servez le dossier avec n'importe quel serveur web, par exemple :

```bash
python -m http.server 8123
```

Puis ouvrez http://localhost:8123.

---

## License / Licence

pdf.js – Apache-2.0 · pdf-lib – MIT
