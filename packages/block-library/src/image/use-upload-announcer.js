/**
 * WordPress dependencies
 */
import { useEffect, useRef } from '@wordpress/element';
import { useSelect } from '@wordpress/data';
import { speak } from '@wordpress/a11y';
import { __, sprintf } from '@wordpress/i18n';
import { store as uploadMediaStore } from '@wordpress/upload-media';

/**
 * Internal dependencies
 */
import { unlock } from '../lock-unlock';

/**
 * Hook that announces upload status changes for screen readers.
 *
 * Uses wp.a11y.speak to make announcements when:
 * - Upload starts (polite)
 * - Upload completes successfully (polite)
 * - Upload fails with an error (assertive)
 *
 * @param {string}  url        The blob URL of the uploading image.
 * @param {boolean} isComplete Whether the upload is complete (no temporaryURL).
 * @param {string}  filename   Optional filename for more descriptive announcements.
 */
export default function useUploadAnnouncer( url, isComplete, filename = '' ) {
	const hasAnnouncedStart = useRef( false );
	const hasAnnouncedComplete = useRef( false );
	const previousErrorRef = useRef( null );

	const { itemError } = useSelect(
		( select ) => {
			if ( ! url ) {
				return { itemError: undefined };
			}

			const { getItemByBlobUrl } = unlock( select( uploadMediaStore ) );
			const item = getItemByBlobUrl( url );

			return {
				itemError: item?.error,
			};
		},
		[ url ]
	);

	// Announce upload start
	useEffect( () => {
		if ( url && ! hasAnnouncedStart.current ) {
			// Disable reason: Updating a ref is a standard React pattern for
			// tracking state across renders without causing re-renders.
			// eslint-disable-next-line react-compiler/react-compiler
			hasAnnouncedStart.current = true;
			const message = filename
				? sprintf(
						/* translators: %s: filename */
						__( 'Uploading %s…' ),
						filename
				  )
				: __( 'Uploading image…' );
			speak( message, 'polite' );
		}
	}, [ url, filename ] );

	// Announce upload completion
	useEffect( () => {
		if (
			isComplete &&
			hasAnnouncedStart.current &&
			! hasAnnouncedComplete.current
		) {
			hasAnnouncedComplete.current = true;
			const message = filename
				? sprintf(
						/* translators: %s: filename */
						__( '%s uploaded successfully.' ),
						filename
				  )
				: __( 'Image uploaded successfully.' );
			speak( message, 'polite' );
		}
	}, [ isComplete, filename ] );

	// Announce errors
	useEffect( () => {
		if ( itemError && previousErrorRef.current !== itemError ) {
			previousErrorRef.current = itemError;
			const message = itemError.message
				? sprintf(
						/* translators: %s: error message */
						__( 'Upload failed: %s' ),
						itemError.message
				  )
				: __( 'Upload failed.' );
			speak( message, 'assertive' );
		}
	}, [ itemError ] );

	// Reset announcements when URL changes (new upload)
	useEffect( () => {
		hasAnnouncedStart.current = false;
		hasAnnouncedComplete.current = false;
		previousErrorRef.current = null;
	}, [ url ] );
}
