/**
 * WordPress dependencies
 */
import { useSelect, useDispatch } from '@wordpress/data';
import { ProgressBar, Button } from '@wordpress/components';
import { __ } from '@wordpress/i18n';
import { store as uploadMediaStore } from '@wordpress/upload-media';

/**
 * Internal dependencies
 */
import { unlock } from '../lock-unlock';

/**
 * Gets a user-friendly label for an upload operation.
 *
 * @param {string|undefined} operation The current operation type.
 * @return {string} The localized label for the operation.
 */
function getOperationLabel( operation ) {
	switch ( operation ) {
		case 'PREPARE':
			return __( 'Preparing…' );
		case 'UPLOAD':
			return __( 'Uploading…' );
		case 'RESIZE_CROP':
			return __( 'Resizing…' );
		case 'ROTATE':
			return __( 'Rotating…' );
		case 'TRANSCODE_IMAGE':
			return __( 'Compressing…' );
		case 'THUMBNAIL_GENERATION':
			return __( 'Generating thumbnails…' );
		default:
			return __( 'Processing…' );
	}
}

/**
 * Component that displays upload progress overlay on the image block.
 *
 * @param {Object}   props          Component props.
 * @param {string}   props.url      The blob URL of the uploading image.
 * @param {Function} props.onCancel Callback when cancel button is clicked.
 */
export default function UploadingOverlay( { url, onCancel } ) {
	const { progress, currentOperation, itemId } = useSelect(
		( select ) => {
			const { getItemByBlobUrl } = unlock( select( uploadMediaStore ) );
			const item = getItemByBlobUrl( url );

			return {
				progress: item?.progress,
				currentOperation: item?.currentOperation,
				itemId: item?.id,
			};
		},
		[ url ]
	);

	const { cancelItem } = useDispatch( uploadMediaStore );

	const handleCancel = () => {
		if ( itemId ) {
			cancelItem( itemId, new Error( __( 'Upload cancelled by user' ) ) );
		}
		onCancel?.();
	};

	// Convert progress from 0-100 to percentage for display
	const progressValue =
		typeof progress === 'number' ? Math.round( progress ) : undefined;

	return (
		<div className="wp-block-image__upload-overlay">
			<ProgressBar value={ progressValue } />
			<span className="wp-block-image__upload-overlay-label">
				{ getOperationLabel( currentOperation ) }
				{ typeof progressValue === 'number' && ` ${ progressValue }%` }
			</span>
			<Button
				__next40pxDefaultSize
				variant="secondary"
				onClick={ handleCancel }
			>
				{ __( 'Cancel' ) }
			</Button>
		</div>
	);
}
