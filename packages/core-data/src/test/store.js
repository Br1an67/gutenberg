/**
 * WordPress dependencies
 */
import triggerFetch from '@wordpress/api-fetch';
import { createRegistry } from '@wordpress/data';

/**
 * Internal dependencies
 */
import { store as coreDataStore } from '../index';

jest.mock( '@wordpress/api-fetch' );

function createTestRegistry() {
	const registry = createRegistry();

	// Register the core-data store
	registry.register( coreDataStore );

	const postEntityConfig = {
		kind: 'postType',
		baseURL: '/wp/v2/posts',
		baseURLParams: {
			context: 'edit',
		},
		name: 'post',
		label: 'Posts',
		transientEdits: {
			blocks: true,
			selection: true,
		},
		mergedEdits: {
			meta: true,
		},
		rawAttributes: [ 'title', 'excerpt', 'content' ],
		__unstable_rest_base: 'posts',
		supportsPagination: true,
		revisionKey: 'id',
		getRevisionsUrl: ( parentId, revisionId ) =>
			`/wp/v2/posts/${ parentId }/revisions${
				revisionId ? '/' + revisionId : ''
			}`,
	};

	// Add the post entity to the store
	registry.dispatch( coreDataStore ).addEntities( [ postEntityConfig ] );

	return registry;
}

function createTestPost( id = 1, fields = [] ) {
	const post = {
		id,
		author: 1,
		content: {
			raw: '<!-- wp:paragraph -->\n<p>A paragraph</p>\n<!-- /wp:paragraph -->',
			rendered: '\n<p>A paragraph</p>\n',
		},
		excerpt: {
			raw: '',
			rendered: '<p>A paragraph</p>\n',
		},
		title: {
			raw: 'Test',
			rendered: 'Test',
		},
		featured_media: 0,
		type: 'post',
		status: 'draft',
		slug: '',
	};

	if ( fields.length > 0 ) {
		return Object.fromEntries(
			fields.map( ( field ) => [ field, post[ field ] ] )
		);
	}

	return post;
}

describe( 'getEntityRecord', () => {
	let registry;

	beforeEach( () => {
		registry = createTestRegistry();
		triggerFetch.mockReset();
	} );

	it( 'should not make a request if the record is already in store', async () => {
		const { getEntityRecord } = registry.resolveSelect( coreDataStore );
		const post = createTestPost( 1 );
		triggerFetch.mockResolvedValue( {
			async json() {
				return post;
			},
		} );

		// Resolve the record.
		await expect(
			getEntityRecord( 'postType', 'post', post.id, { context: 'edit' } )
		).resolves.toEqual( post );

		triggerFetch.mockReset();

		await expect(
			getEntityRecord( 'postType', 'post', post.id, {
				context: 'edit',
				_fields: [ 'id', 'author', 'title' ],
			} )
		).resolves.toEqual( {
			id: post.id,
			author: post.author,
			title: post.title,
		} );
		expect( triggerFetch ).not.toHaveBeenCalled();
	} );
} );

describe( 'clearEntityRecordEdits', () => {
	let registry;

	beforeEach( () => {
		registry = createTestRegistry();
		triggerFetch.mockReset();
	} );

	it( 'should return the persisted record after clearing edits', () => {
		const post = createTestPost( 1 );
		const dispatch = registry.dispatch( coreDataStore );
		const select = registry.select( coreDataStore );

		dispatch.receiveEntityRecords( 'postType', 'post', post );
		dispatch.editEntityRecord( 'postType', 'post', post.id, {
			slug: 'updated-slug',
		} );

		expect(
			select.getEditedEntityRecord( 'postType', 'post', post.id ).slug
		).toBe( 'updated-slug' );

		dispatch.clearEntityRecordEdits( 'postType', 'post', post.id );

		expect(
			select.getEditedEntityRecord( 'postType', 'post', post.id )
		).toEqual( select.getRawEntityRecord( 'postType', 'post', post.id ) );
	} );
} );

describe( 'getRevisions', () => {
	const KIND = 'postType';
	const NAME = 'post';
	const RECORD_KEY = 1;
	const REVISIONS = [ { id: 1 }, { id: 2 }, { id: 3 } ];

	let registry;

	beforeEach( () => {
		registry = createTestRegistry();
		triggerFetch.mockReset();
	} );

	// eslint-disable-next-line jest/no-disabled-tests
	it.skip( 'preserves all revisions when getRevision resolves after getRevisions', async () => {
		let resolveSlowFetch;
		const slowFetchPromise = new Promise( ( resolve ) => {
			resolveSlowFetch = resolve;
		} );

		triggerFetch.mockImplementation( ( { path } ) => {
			if ( path && path.includes( 'revisions' ) ) {
				// Single revision fetch: return slow promise.
				if ( /revisions\/\d+/.test( path ) ) {
					return slowFetchPromise;
				}
				// Collection fetch: return immediately.
				return Promise.resolve( {
					json: () => Promise.resolve( REVISIONS ),
					headers: { get: () => String( REVISIONS.length ) },
				} );
			}
			return Promise.resolve( {} );
		} );

		const resolveSelectStore = registry.resolveSelect( coreDataStore );

		// Start getRevision first (slow), then getRevisions (fast).
		const revisionPromise = resolveSelectStore.getRevision(
			KIND,
			NAME,
			RECORD_KEY,
			1,
			{ context: 'edit' }
		);
		await resolveSelectStore.getRevisions( KIND, NAME, RECORD_KEY, {
			context: 'edit',
		} );

		// Now resolve the slow single-revision fetch.
		resolveSlowFetch( REVISIONS[ 0 ] );
		await revisionPromise;

		// Wait for all pending thunks (receiveRevisions) to settle.
		await new Promise( ( resolve ) => setTimeout( resolve, 0 ) );

		const allRevisions = registry
			.select( coreDataStore )
			.getRevisions( KIND, NAME, RECORD_KEY, { context: 'edit' } );
		expect( allRevisions ).toHaveLength( REVISIONS.length );
	} );

	it( 'preserves all revisions when getRevision is called after getRevisions with the same query', async () => {
		triggerFetch.mockImplementation( ( { path } ) => {
			if ( path && path.includes( 'revisions' ) ) {
				return Promise.resolve( {
					json: () => Promise.resolve( REVISIONS ),
					headers: { get: () => String( REVISIONS.length ) },
				} );
			}
			return Promise.resolve( {} );
		} );

		const resolveSelectStore = registry.resolveSelect( coreDataStore );

		await resolveSelectStore.getRevisions( KIND, NAME, RECORD_KEY, {
			context: 'edit',
		} );

		triggerFetch.mockImplementation( ( { path } ) => {
			if ( path && path.includes( 'revisions' ) ) {
				return Promise.resolve( REVISIONS[ 0 ] );
			}
			return Promise.resolve( {} );
		} );
		triggerFetch.mockClear();

		// Call getRevision for revision 1 with the same query.
		// With the fix: resolver is already marked done → no API call.
		// Without the fix: resolver fires → receives single revision with
		// { context: 'edit' } query → getMergedItemIds corrupts stored IDs.
		await resolveSelectStore.getRevision( KIND, NAME, RECORD_KEY, 1, {
			context: 'edit',
		} );

		expect( triggerFetch ).not.toHaveBeenCalled();

		const allRevisions = registry
			.select( coreDataStore )
			.getRevisions( KIND, NAME, RECORD_KEY, { context: 'edit' } );
		expect( allRevisions ).toHaveLength( 3 );
	} );
} );
