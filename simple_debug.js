// Simple debug - paste this in browser console on client sessions page
(async function() {
  console.log('=== SIMPLE DEBUG ===');
  
  // Try to get supabase from different sources
  let supabase = window.supabase;
  if (!supabase) {
    // Try to get from React devtools
    const reactRoot = document.querySelector('#root');
    if (reactRoot && reactRoot._reactInternalContainer) {
      const fiber = reactRoot._reactInternalContainer;
      // Try to find supabase in React component tree
      console.log('Looking for supabase in React tree...');
    }
  }
  
  if (!supabase) {
    console.error('Cannot access supabase. Try this instead:');
    console.log('1. Look at the existing debug logs in console');
    console.log('2. Check what the filtering logs show');
    return;
  }
  
  const { data: { user } } = await supabase.auth.getUser();
  console.log('User:', user);
  
  const { data: meetings } = await supabase.from('meetings').select('*');
  console.log('All meetings:', meetings);
  
  if (meetings && meetings.length > 0) {
    meetings.forEach(meeting => {
      console.log(`Meeting: ${meeting.summary}`);
      console.log('Attendees:', meeting.attendees);
      console.log('User email in attendees:', meeting.attendees?.includes(user.email));
    });
  } else {
    console.log('No meetings found in database');
  }
})();
