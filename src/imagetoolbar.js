/**
 * @license Copyright (c) 2003-2018, CKSource - Frederico Knabben. All rights reserved.
 * For licensing, see LICENSE.md.
 */

/**
 * @module image/imagetoolbar
 */

import Plugin from '@ckeditor/ckeditor5-core/src/plugin';
import ToolbarView from '@ckeditor/ckeditor5-ui/src/toolbar/toolbarview';
import ContextualBalloon from '@ckeditor/ckeditor5-ui/src/panel/balloon/contextualballoon';
import { isImageWidgetSelected } from './image/utils';
import { repositionContextualBalloon, getBalloonPositionData } from './image/ui/utils';

const balloonClassName = 'ck-toolbar-container';

/**
 * The image toolbar plugin. It creates and manages the image toolbar (the toolbar displayed when an image is selected).
 *
 * For a detailed overview, check the {@glink features/image#image-contextual-toolbar image contextual toolbar} documentation.
 *
 * Instanecs of toolbar components (e.g. buttons) are created using the editor's
 * {@link module:ui/componentfactory~ComponentFactory component factory}
 * based on the {@link module:image/image~ImageConfig#toolbar `image.toolbar` configuration option}.
 *
 * The toolbar uses the {@link module:ui/panel/balloon/contextualballoon~ContextualBalloon}.
 *
 * @extends module:core/plugin~Plugin
 */
export default class ImageToolbar extends Plugin {
	/**
	 * @inheritDoc
	 */
	static get requires() {
		return [ ContextualBalloon ];
	}

	/**
	 * @inheritDoc
	 */
	static get pluginName() {
		return 'OwlImageToolbar';
	}

	/**
	 * @inheritDoc
	 */
	init() {
		const editor = this.editor;
		const balloonToolbar = editor.plugins.get( 'BalloonToolbar' );

		// If the `BalloonToolbar` plugin is loaded, it should be disabled for images
		// which have their own toolbar to avoid duplication.
		// https://github.com/ckeditor/ckeditor5-image/issues/110
		if ( balloonToolbar ) {
			this.listenTo( balloonToolbar, 'show', evt => {
				if ( isImageWidgetSelected( editor.editing.view.document.selection ) ) {
					evt.stop();
				}
			}, { priority: 'high' } );
		}
	}

	/**
	 * @inheritDoc
	 */
	afterInit() {
		const editor = this.editor;
		const toolbarConfig = editor.config.get( 'image.toolbar' );

		// Don't add the toolbar if there is no configuration.
		if ( !toolbarConfig || !toolbarConfig.length ) {
			return;
		}

		/**
		 * A contextual balloon plugin instance.
		 *
		 * @private
		 * @member {module:ui/panel/balloon/contextualballoon~ContextualBalloon}
		 */
		this._balloon = this.editor.plugins.get( 'ContextualBalloon' );

		/**
		 * A `ToolbarView` instance used to display the buttons specific for image editing.
		 *
		 * @protected
		 * @type {module:ui/toolbar/toolbarview~ToolbarView}
		 */
		this._toolbar = new ToolbarView();

		// Add buttons to the toolbar.
		this._toolbar.fillFromConfig( toolbarConfig, editor.ui.componentFactory );

		// Show balloon panel each time image widget is selected.
		this.listenTo( editor.ui, 'update', () => {
			this._checkIsVisible();
		} );

		// UI#update is not fired after focus is back in editor, we need to check if balloon panel should be visible.
		this.listenTo( editor.ui.focusTracker, 'change:isFocused', () => {
			this._checkIsVisible();
		}, { priority: 'low' } );
	}

	/**
	 * Checks whether the toolbar should show up or hide depending on the current selection.
	 *
	 * @private
	 */
	_checkIsVisible() {
		const editor = this.editor;

		if ( !editor.ui.focusTracker.isFocused || !isImageWidgetSelected( editor.editing.view.document.selection ) ) {
			this._hideToolbar();
		} else {
			this._showToolbar();
		}
	}

	/**
	 * Shows the {@link #_toolbar} in the {@link #_balloon}.
	 *
	 * @private
	 */
	_showToolbar() {
		const editor = this.editor;

		if ( this._isVisible ) {
			repositionContextualBalloon( editor );
		} else if ( !this._balloon.hasView( this._toolbar ) ) {
			this._balloon.add( {
				view: this._toolbar,
				position: getBalloonPositionData( editor ),
				balloonClassName
			} );
		}
	}

	/**
	 * Removes the {@link #_toolbar} from the {@link #_balloon}.
	 *
	 * @private
	 */
	_hideToolbar() {
		if ( !this._isVisible ) {
			return;
		}

		this._balloon.remove( this._toolbar );
	}

	/**
	 * Returns `true` when the {@link #_toolbar} is the visible view in the {@link #_balloon}.
	 *
	 * @private
	 * @type {Boolean}
	 */
	get _isVisible() {
		return this._balloon.visibleView == this._toolbar;
	}
}

/**
 * Items to be placed in the image toolbar.
 * This option is used by the {@link module:image/imagetoolbar~ImageToolbar} feature.
 *
 * Assuming that you use the following features:
 *
 * * {@link module:image/imagestyle~ImageStyle} (with a default configuration),
 * * {@link module:image/imagetextalternative~ImageTextAlternative},
 *
 * three toolbar items will be available in {@link module:ui/componentfactory~ComponentFactory}:
 * `'imageStyle:full'`, `'imageStyle:side'`, and `'imageTextAlternative'` so you can configure the toolbar like this:
 *
 *		const imageConfig = {
 *			toolbar: [ 'imageStyle:full', 'imageStyle:side', '|', 'imageTextAlternative' ]
 *		};
 *
 * Of course, the same buttons can also be used in the
 * {@link module:core/editor/editorconfig~EditorConfig#toolbar main editor toolbar}.
 *
 * Read more about configuring toolbar in {@link module:core/editor/editorconfig~EditorConfig#toolbar}.
 *
 * @member {Array.<String>} module:image/image~ImageConfig#toolbar
 */
