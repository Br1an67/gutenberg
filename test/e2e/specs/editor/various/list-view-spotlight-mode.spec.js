/**
 * WordPress dependencies
 */
const { test, expect } = require( '@wordpress/e2e-test-utils-playwright' );

test.describe( 'List View Spotlight Mode', () => {
	test.beforeAll( async ( { requestUtils } ) => {
		await requestUtils.deleteAllBlocks();
	} );

	test.beforeEach( async ( { admin } ) => {
		await admin.createNewPost();
	} );

	test.afterEach( async ( { requestUtils } ) => {
		await requestUtils.deleteAllBlocks();
	} );

	/**
	 * Helper function to create a Group block with two paragraphs and convert it to an unsynced pattern.
	 *
	 * @param {Object} editor Editor utilities
	 * @param {Object} page   Page object
	 */
	async function createPatternWithContent( editor, page ) {
		// Create a Group block with two paragraphs inside
		await editor.insertBlock( { name: 'core/group' } );
		await editor.canvas
			.locator(
				'role=button[name="Group: Gather blocks in a container."i]'
			)
			.click();

		// Add first paragraph inside the group
		await editor.canvas.locator( 'role=button[name="Add block"i]' ).click();
		await page
			.getByRole( 'listbox', { name: 'Blocks' } )
			.getByRole( 'option', { name: 'Paragraph' } )
			.click();
		await page.keyboard.type( 'Pattern paragraph 1' );
		await page.keyboard.press( 'Enter' );

		// Add second paragraph inside the group
		await page.keyboard.type( 'Pattern paragraph 2' );

		// Create an unsynced pattern from the Group block
		await editor.selectBlocks(
			editor.canvas.getByRole( 'document', {
				name: 'Block: Group',
			} )
		);

		// Create pattern from block options
		await editor.showBlockToolbar();
		await page
			.getByRole( 'toolbar', { name: 'Block tools' } )
			.getByRole( 'button', { name: 'Options' } )
			.click();
		await page.getByRole( 'menuitem', { name: 'Create pattern' } ).click();

		const createPatternDialog = page.getByRole( 'dialog', {
			name: 'add pattern',
		} );
		await createPatternDialog
			.getByRole( 'textbox', { name: 'Name' } )
			.fill( 'Test Pattern for Spotlight' );
		await createPatternDialog
			.getByRole( 'checkbox', { name: 'Synced' } )
			.setChecked( false ); // Make it unsynced

		await page.keyboard.press( 'Enter' );
	}

	/**
	 * Helper function to enter spotlight mode and open list view.
	 *
	 * @param {Object} editor    Editor utilities
	 * @param {Object} page      Page object
	 * @param {Object} pageUtils Page utilities
	 */
	async function enterSpotlightModeAndOpenListView(
		editor,
		page,
		pageUtils
	) {
		// Enter spotlight mode by selecting the Group block and clicking "Edit section"
		await editor.selectBlocks(
			editor.canvas.getByRole( 'document', {
				name: 'Block: Group',
			} )
		);

		// Click "Edit section" from the block options menu
		await editor.clickBlockOptionsMenuItem( 'Edit section' );

		// Open the list view
		await pageUtils.pressKeys( 'access+o' );
		const listView = page.getByRole( 'treegrid', {
			name: 'Block navigation structure',
		} );
		await expect( listView ).toBeVisible();
	}

	test( 'should show disabled blocks in list view and constrain keyboard navigation', async ( {
		editor,
		page,
		pageUtils,
	} ) => {
		await createPatternWithContent( editor, page );

		await editor.insertBlock( { name: 'core/paragraph' } );
		await page.keyboard.type( 'Block beneath pattern' );

		await enterSpotlightModeAndOpenListView( editor, page, pageUtils );

		const listView = page.getByRole( 'treegrid', {
			name: 'Block navigation structure',
		} );

		const groupBlock = listView.getByRole( 'gridcell', {
			name: 'Test Pattern for Spotlight',
			exact: true,
		} );
		await expect( groupBlock ).toBeVisible();

		const paragraphBlocks = listView.getByRole( 'gridcell', {
			name: 'Paragraph',
			exact: true,
		} );
		const blockBeneathPattern = paragraphBlocks.last();
		await expect( blockBeneathPattern ).toBeVisible();

		const fadedBlockRow = blockBeneathPattern.locator( '..' );
		await expect( fadedBlockRow ).toHaveClass( /is-faded-in-spotlight/ );

		// Keyboard navigation should be constrained to the pattern
		await editor.canvas
			.getByRole( 'document', {
				name: 'Block: Paragraph',
			} )
			.first()
			.click();

		await page.keyboard.press( 'ArrowDown' );

		const patternParagraph2 = editor.canvas
			.getByRole( 'document', {
				name: 'Block: Paragraph',
			} )
			.filter( { hasText: 'Pattern paragraph 2' } );
		await expect( patternParagraph2 ).toBeFocused();

		// Attempting to navigate beyond the pattern should be prevented
		await page.keyboard.press( 'ArrowDown' );
		await expect( patternParagraph2 ).toBeFocused();

		const blockBeneath = editor.canvas
			.getByRole( 'document', {
				name: 'Block: Paragraph',
			} )
			.filter( { hasText: 'Block beneath pattern' } );
		await expect( blockBeneath ).not.toBeFocused();
	} );

	test( 'should exit spotlight mode when clicking faded block in list view', async ( {
		editor,
		page,
		pageUtils,
	} ) => {
		await createPatternWithContent( editor, page );

		await editor.insertBlock( { name: 'core/paragraph' } );
		await page.keyboard.type( 'Block beneath pattern' );

		await enterSpotlightModeAndOpenListView( editor, page, pageUtils );

		const listView = page.getByRole( 'treegrid', {
			name: 'Block navigation structure',
		} );
		const paragraphBlocks = listView.getByRole( 'gridcell', {
			name: 'Paragraph',
			exact: true,
		} );
		const blockBeneathPattern = paragraphBlocks.last();
		const fadedBlockRow = blockBeneathPattern.locator( '..' );
		await expect( fadedBlockRow ).toHaveClass( /is-faded-in-spotlight/ );

		// Force click on the faded block to exit spotlight mode (aria-disabled="true")
		const fadedBlockButton = blockBeneathPattern.locator(
			'.block-editor-list-view-block-contents'
		);
		// eslint-disable-next-line playwright/no-force-option
		await fadedBlockButton.click( { force: true } );

		await expect( fadedBlockRow ).not.toHaveClass(
			/is-faded-in-spotlight/
		);

		const blockBeneath = editor.canvas
			.getByRole( 'document', {
				name: 'Block: Paragraph',
			} )
			.filter( { hasText: 'Block beneath pattern' } );
		await expect( blockBeneath ).toBeVisible();
	} );

	test( 'should exit spotlight mode when pressing Escape key', async ( {
		editor,
		page,
		pageUtils,
	} ) => {
		await createPatternWithContent( editor, page );

		await editor.insertBlock( { name: 'core/paragraph' } );
		await page.keyboard.type( 'Block beneath pattern' );

		await enterSpotlightModeAndOpenListView( editor, page, pageUtils );

		const listView = page.getByRole( 'treegrid', {
			name: 'Block navigation structure',
		} );
		const paragraphBlocks = listView.getByRole( 'gridcell', {
			name: 'Paragraph',
			exact: true,
		} );
		const blockBeneathPattern = paragraphBlocks.last();
		const fadedBlockRow = blockBeneathPattern.locator( '..' );
		await expect( fadedBlockRow ).toHaveClass( /is-faded-in-spotlight/ );

		await editor.canvas
			.getByRole( 'document', {
				name: 'Block: Paragraph',
			} )
			.first()
			.click();

		await page.keyboard.press( 'Escape' );

		await expect( fadedBlockRow ).not.toHaveClass(
			/is-faded-in-spotlight/
		);

		const blockBeneath = editor.canvas
			.getByRole( 'document', {
				name: 'Block: Paragraph',
			} )
			.filter( { hasText: 'Block beneath pattern' } );

		await blockBeneath.click();
		await expect( blockBeneath ).toBeFocused();
	} );
} );
