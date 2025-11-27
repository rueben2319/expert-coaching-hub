// Run this in browser console on the client sessions page
// This will show exactly what meetings exist and why filtering isn't working

async function debugClientSessions() {
  // Access supabase from the window object (React app)
  const { supabase } = window;
  if (!supabase) {
    console.error('Supabase not found. Make sure you run this on the app page.');
    return;
  }
  
  const { data: { user } } = await supabase.auth.getUser();
  console.log('=== DEBUG CLIENT SESSIONS ===');
  console.log('Current user:', user);
  
  // Get all meetings
  const { data: meetings, error } = await supabase
    .from('meetings')
    .select('*')
    .order('start_time', { ascending: true });
    
  console.log('All meetings in database:', meetings);
  console.log('Error:', error);
  
  // Check each meeting
  meetings.forEach((meeting, index) => {
    console.log(`\n=== MEETING ${index + 1} ===`);
    console.log('ID:', meeting.id);
    console.log('Summary:', meeting.summary);
    console.log('Attendees:', meeting.attendees);
    console.log('Attendees type:', typeof meeting.attendees);
    console.log('Is array:', Array.isArray(meeting.attendees));
    
    if (Array.isArray(meeting.attendees)) {
      console.log('Attendees includes user email:', meeting.attendees.includes(user.email));
      console.log('Exact match check:');
      meeting.attendees.forEach(email => {
        console.log(`  "${email}" === "${user.email}" ?`, email === user.email);
        console.log(`  "${email}" === "${user.email.toLowerCase()}" ?`, email === user.email.toLowerCase());
        console.log(`  "${email.toLowerCase()}" === "${user.email.toLowerCase()}" ?`, email.toLowerCase() === user.email.toLowerCase());
      });
    }
  });
}

// Run the debug function
debugClientSessions();
