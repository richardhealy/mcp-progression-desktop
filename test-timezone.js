// Test timezone conversion logic
const timezone = 'Asia/Makassar';
const now = new Date();

console.log('=== Timezone Test ===');
console.log('Local time:', now.toLocaleString());
console.log('Timezone:', timezone);

// Test the same logic as in the extension
const timeInTimezone = new Date(now.toLocaleString("en-US", {timeZone: timezone}));
console.log('Time in timezone (method 1):', timeInTimezone.toLocaleString());
console.log('Hours:', timeInTimezone.getHours());
console.log('Day of week:', timeInTimezone.getDay());

// Alternative method
const formatter = new Intl.DateTimeFormat('en-US', {
  timeZone: timezone,
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
  hour: '2-digit',
  minute: '2-digit',
  second: '2-digit',
  hour12: false
});

console.log('Time in timezone (method 2):', formatter.format(now));

// Check working hours
const currentTime = timeInTimezone.getHours() * 60 + timeInTimezone.getMinutes();
const startTime = 9 * 60; // 9:00 AM
const endTime = 17 * 60; // 5:00 PM
const workingDays = [1, 2, 3, 4, 5]; // Monday to Friday

const isWorkingDay = workingDays.includes(timeInTimezone.getDay());
const isWorkingTime = currentTime >= startTime && currentTime <= endTime;

console.log('=== Working Hours Check ===');
console.log('Is working day?', isWorkingDay);
console.log('Is working time?', isWorkingTime);
console.log('Should show as active?', isWorkingDay && isWorkingTime); 