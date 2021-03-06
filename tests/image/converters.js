/**
 * @license Copyright (c) 2003-2018, CKSource - Frederico Knabben. All rights reserved.
 * For licensing, see LICENSE.md.
 */

import {
	viewFigureToModel,
	modelToViewAttributeConverter
} from '../../src/image/converters';
import { toImageWidget } from '../../src/image/utils';
import { createImageViewElement } from '../../src/image/imageediting';
import VirtualTestEditor from '@ckeditor/ckeditor5-core/tests/_utils/virtualtesteditor';

import { downcastElementToElement } from '@ckeditor/ckeditor5-engine/src/conversion/downcast-converters';
import { upcastElementToElement } from '@ckeditor/ckeditor5-engine/src/conversion/upcast-converters';

import ModelRange from '@ckeditor/ckeditor5-engine/src/model/range';
import { getData as getViewData } from '@ckeditor/ckeditor5-engine/src/dev-utils/view';
import { setData as setModelData, getData as getModelData } from '@ckeditor/ckeditor5-engine/src/dev-utils/model';
import env from '@ckeditor/ckeditor5-utils/src/env';
import testUtils from '@ckeditor/ckeditor5-core/tests/_utils/utils';

describe( 'Image converters', () => {
	let editor, model, document, viewDocument;

	testUtils.createSinonSandbox();

	beforeEach( () => {
		// Most tests assume non-edge environment but we do not set `contenteditable=false` on Edge so stub `env.isEdge`.
		testUtils.sinon.stub( env, 'isEdge' ).get( () => false );

		return VirtualTestEditor.create()
			.then( newEditor => {
				editor = newEditor;
				model = editor.model;
				document = model.document;
				viewDocument = editor.editing.view;

				const schema = model.schema;

				schema.register( 'image', {
					allowWhere: '$block',
					allowAttributes: [ 'alt', 'src' ],
					isObject: true,
					isBlock: true
				} );

				const editingElementCreator = ( modelElement, viewWriter ) =>
					toImageWidget( createImageViewElement( viewWriter ), viewWriter, '' );

				editor.conversion.for( 'editingDowncast' ).add( downcastElementToElement( {
					model: 'image',
					view: editingElementCreator
				} ) );

				editor.conversion.for( 'downcast' )
					.add( modelToViewAttributeConverter( 'src' ) )
					.add( modelToViewAttributeConverter( 'alt' ) );
			} );
	} );

	describe( 'viewFigureToModel', () => {
		function expectModel( data ) {
			expect( getModelData( model, { withoutSelection: true } ) ).to.equal( data );
		}

		let schema, imgConverterCalled;

		beforeEach( () => {
			// Since this part of test tests only view->model conversion editing pipeline is not necessary
			// so defining model->view converters won't be necessary.
			editor.editing.destroy();

			schema = model.schema;
			schema.extend( '$text', { allowIn: 'image' } );

			editor.conversion.for( 'upcast' )
				.add( viewFigureToModel() )
				.add( upcastElementToElement( {
					view: {
						name: 'img',
						attributes: {
							src: true
						}
					},
					model: ( viewImage, writer ) => {
						imgConverterCalled = true;

						return writer.createElement( 'image', { src: viewImage.getAttribute( 'src' ) } );
					}
				} ) );
		} );

		it( 'should find img element among children and convert it using already defined converters', () => {
			editor.setData( '<figure class="image"><img src="foo.png" /></figure>' );

			expectModel( '<image src="foo.png"></image>' );
			expect( imgConverterCalled ).to.be.true;
		} );

		it( 'should convert children allowed by schema and omit disallowed', () => {
			editor.conversion.for( 'upcast' ).add( upcastElementToElement( { view: 'foo', model: 'foo' } ) );
			editor.conversion.for( 'upcast' ).add( upcastElementToElement( { view: 'bar', model: 'bar' } ) );

			schema.register( 'foo', { allowIn: 'image' } );
			// Is allowed in root, but should not try to split image element.
			schema.register( 'bar', { allowIn: '$root' } );

			editor.setData( '<figure class="image">x<img src="foo.png" />y<foo></foo><bar></bar></figure>' );

			// Element bar not converted because schema does not allow it.
			expectModel( '<image src="foo.png">xy<foo></foo></image>' );
		} );

		it( 'should split parent element when image is not allowed - in the middle', () => {
			editor.conversion.for( 'upcast' ).add( upcastElementToElement( { view: 'div', model: 'div' } ) );

			schema.register( 'div', { inheritAllFrom: '$block' } );
			schema.extend( 'image', { disallowIn: 'div' } );

			editor.setData(
				'<div>' +
					'abc' +
					'<figure class="image">' +
						'<img src="foo.jpg"/>' +
					'</figure>' +
					'def' +
				'</div>'
			);

			expectModel( '<div>abc</div><image src="foo.jpg"></image><div>def</div>' );
		} );

		it( 'should split parent element when image is not allowed - at the end', () => {
			editor.conversion.elementToElement( { model: 'div', view: 'div' } );

			schema.register( 'div', { inheritAllFrom: '$block' } );
			schema.extend( 'image', { disallowIn: 'div' } );

			editor.setData(
				'<div>' +
					'abc' +
					'<figure class="image">' +
						'<img src="foo.jpg"/>' +
					'</figure>' +
				'</div>'
			);

			expectModel( '<div>abc</div><image src="foo.jpg"></image>' );
		} );

		it( 'should split parent element when image is not allowed - at the beginning', () => {
			editor.conversion.elementToElement( { model: 'div', view: 'div' } );

			schema.register( 'div', { inheritAllFrom: '$block' } );
			schema.extend( 'image', { disallowIn: 'div' } );

			editor.setData(
				'<div>' +
					'<figure class="image">' +
						'<img src="foo.jpg"/>' +
					'</figure>' +
					'def' +
				'</div>'
			);

			expectModel( '<image src="foo.jpg"></image><div>def</div>' );
		} );

		it( 'should be possible to overwrite', () => {
			editor.data.upcastDispatcher.on( 'element:figure', ( evt, data, conversionApi ) => {
				conversionApi.consumable.consume( data.viewItem, { name: true } );
				conversionApi.consumable.consume( data.viewItem.getChild( 0 ), { name: true } );

				const element = conversionApi.writer.createElement( 'myImage', {
					data: {
						src: data.viewItem.getChild( 0 ).getAttribute( 'src' )
					}
				} );
				conversionApi.writer.insert( element, data.modelCursor );
				data.modelRange = ModelRange.createOn( element );
				data.modelCursor = data.modelRange.end;
			}, { priority: 'high' } );

			editor.setData( '<figure class="image"><img src="foo.png" />xyz</figure>' );

			expectModel( '<myImage data="{"src":"foo.png"}"></myImage>' );
		} );

		// Test exactly what figure converter does, which is putting it's children element to image element.
		// If this has not been done, it means that figure converter was not used.
		it( 'should not convert if figure do not have class="image" attribute', () => {
			editor.setData( '<figure><img src="foo.png" />xyz</figure>' );

			// Default image converter will be fired.
			expectModel( '<image src="foo.png"></image>' );
		} );

		it( 'should not convert if there is no img element among children', () => {
			editor.setData( '<figure class="image">xyz</figure>' );

			// Figure converter outputs nothing and text is disallowed in root.
			expectModel( '' );
		} );

		it( 'should not convert if img element was not converted', () => {
			// Image element missing src attribute.
			editor.setData( '<figure class="image"><img alt="abc" />xyz</figure>' );

			// Figure converter outputs nothing and text is disallowed in root.
			expectModel( '' );
		} );
	} );

	describe( 'modelToViewAttributeConverter', () => {
		it( 'should convert adding attribute to image', () => {
			setModelData( model, '<image src=""></image>' );
			const image = document.getRoot().getChild( 0 );

			model.change( writer => {
				writer.setAttribute( 'alt', 'foo bar', image );
			} );

			expect( getViewData( viewDocument, { withoutSelection: true } ) ).to.equal(
				'<figure class="ck-widget image" contenteditable="false"><img alt="foo bar" src=""></img></figure>'
			);
		} );

		it( 'should convert removing attribute from image', () => {
			setModelData( model, '<image src="" alt="foo bar"></image>' );
			const image = document.getRoot().getChild( 0 );

			model.change( writer => {
				writer.removeAttribute( 'alt', image );
			} );

			expect( getViewData( viewDocument, { withoutSelection: true } ) ).to.equal(
				'<figure class="ck-widget image" contenteditable="false"><img src=""></img></figure>'
			);
		} );

		it( 'should convert change of attribute image', () => {
			setModelData( model, '<image src="" alt="foo bar"></image>' );
			const image = document.getRoot().getChild( 0 );

			model.change( writer => {
				writer.setAttribute( 'alt', 'baz quix', image );
			} );

			expect( getViewData( viewDocument, { withoutSelection: true } ) ).to.equal(
				'<figure class="ck-widget image" contenteditable="false"><img alt="baz quix" src=""></img></figure>'
			);
		} );

		it( 'should not set attribute if change was already consumed', () => {
			editor.editing.downcastDispatcher.on( 'attribute:alt:image', ( evt, data, conversionApi ) => {
				conversionApi.consumable.consume( data.item, 'attribute:alt' );
			}, { priority: 'high' } );

			setModelData( model, '<image src="" alt="foo bar"></image>' );

			expect( getViewData( viewDocument, { withoutSelection: true } ) ).to.equal(
				'<figure class="ck-widget image" contenteditable="false"><img src=""></img></figure>'
			);
		} );
	} );
} );
