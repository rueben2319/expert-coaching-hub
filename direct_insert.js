// Run this in browser console on ANY page of the app
// This will directly insert a test meeting into the database

(async function() {
  try {
    // Get current user
    const { data: { user } } = await window.supabase.auth.getUser();
    console.log('Current user:', user);
    
    // Insert a test meeting directly
    const testMeeting = {
      user_id: user.id, // Use current user as coach
      summary: 'Direct Test Meeting',
      description: 'This meeting was inserted directly to test database connectivity',
      start_time: new Date(Date.now() + 60 * 60 * 1000).toISOString(), // 1 hour from now
      end_time: new Date(Date.now() + 2 * 60 * 60 * 1000).toISOString(), // 2 hours from now
      attendees: ['fandikaienterprises@gmail.com', user.email],
      status: 'scheduled',
      meet_link: 'https://meet.google.com/test-direct-insert',
      calendar_event_id: 'test-direct-calendar-id'
    };
    
    console.log('Inserting test meeting:', testMeeting);
    
    const { data, error } = await window.supabase
      .from('meetings')
      .insert(testMeeting)
      .select()
      .single();
      
    if (error) {
      console.error('Insert failed:', error);
    } else {
      console.log('Test meeting inserted successfully:', data);
      
      // Now verify it appears in queries
      const { data: allMeetings } = await window.supabase
        .from('meetings')
        .select('*');
        
      console.log('All meetings now:', allMeetings);
    }
  } catch (error) {
    console.error('Script error:', error);
  }
})();
