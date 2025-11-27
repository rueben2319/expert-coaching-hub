// Run this in browser console on the coach sessions page
// This will create a test meeting for fandikaienterprises@gmail.com

async function createTestMeeting() {
  try {
    const response = await fetch('/api/v1/create-google-meet', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${await supabase.auth.getSession().then(s => s.session?.access_token)}`
      },
      body: JSON.stringify({
        summary: 'Test Coaching Session',
        description: 'Test session to verify client can see invitations',
        startTime: new Date(Date.now() + 60 * 60 * 1000).toISOString(), // 1 hour from now
        endTime: new Date(Date.now() + 2 * 60 * 60 * 1000).toISOString(), // 2 hours from now
        attendees: ['fandikaienterprises@gmail.com'],
        courseId: null
      })
    });
    
    const result = await response.json();
    console.log('Test meeting created:', result);
  } catch (error) {
    console.error('Error creating test meeting:', error);
  }
}

// Run the function
createTestMeeting();
