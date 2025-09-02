/**
 * POST /api/contacts/scan - Scan business card
 */
export async function POST(request) {
  try {
    console.log('📇 POST /api/contacts/scan - Processing business card scan');

    // Authenticate user
    const authHeader = request.headers.get('Authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return NextResponse.json(
        { error: 'Authentication required' }, 
        { status: 401 }
      );
    }

    const token = authHeader.split('Bearer ')[1];
    const decodedToken = await verifyIdToken(token);
    const userId = decodedToken.uid;

    // Parse request body
    const body = await request.json();
    const { imageBase64 } = body;

    if (!imageBase64) {
      return NextResponse.json(
        { error: 'Image data is required' }, 
        { status: 400 }
      );
    }

    // Validate image data
    if (typeof imageBase64 !== 'string' || imageBase64.length < 100) {
      return NextResponse.json(
        { error: 'Invalid image data format' }, 
        { status: 400 }
      );
    }

    // Process business card scan
    const result = await ContactService.processBusinessCardScan(userId, imageBase64);

    console.log('✅ Business card processed successfully');
    return NextResponse.json(result);

  } catch (error) {
    console.error('❌ Error in POST /api/contacts/scan:', error);
    
    let status = 500;
    let errorMessage = error.message || 'Failed to process business card';

    if (error.message?.includes('Invalid') || error.message?.includes('format')) {
      status = 400;
    } else if (error.message?.includes('subscription') || error.message?.includes('limit')) {
      status = 402;
    }

    return NextResponse.json(
      { 
        error: errorMessage,
        success: false 
      }, 
      { status }
    );
  }
}
