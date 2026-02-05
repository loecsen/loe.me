#!/usr/bin/env node
/**
 * Seed idea_routines.ndjson with 21 EN routines per category (simple placeholders).
 * Run from repo root: node scripts/seed-idea-routines.mjs
 * Uses apps/web/app/PourLaMaquette/db/tables/idea_routines.ndjson
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, '..');
const tablePath = path.join(root, 'apps/web/app/PourLaMaquette/db/tables', 'idea_routines.ndjson');
const indexPath = path.join(root, 'apps/web/app/PourLaMaquette/db/indexes', 'idea_routines.index.json');

const SEED_BY_CATEGORY = {
  LEARN: [
    { title_en: 'Read 10 pages a day', intent_en: 'Read 10 pages per day for 21 days' },
    { title_en: 'Learn a new word every morning', intent_en: 'Learn one new word every morning for 21 days' },
    { title_en: 'Order a coffee in another language', intent_en: 'Order a coffee in another language within 30 days' },
    { title_en: 'Listen to an educational podcast', intent_en: 'Listen to one educational podcast episode per day for 21 days' },
    { title_en: 'Complete a Duolingo streak', intent_en: 'Maintain a 14-day Duolingo streak' },
    { title_en: 'Watch documentaries with subtitles', intent_en: 'Watch 3 documentaries with target-language subtitles in 21 days' },
    { title_en: 'Practice handwriting 10 min daily', intent_en: 'Practice handwriting 10 minutes daily for 21 days' },
    { title_en: 'Flashcards before bed', intent_en: 'Review 20 flashcards before bed for 14 days' },
    { title_en: 'Shadow a podcast', intent_en: 'Shadow one podcast episode per week for 4 weeks' },
    { title_en: 'Write a short summary in target language', intent_en: 'Write a 50-word summary in the target language every day for 21 days' },
    { title_en: 'Language exchange 3x per week', intent_en: 'Do 3 language exchange sessions per week for 30 days' },
    { title_en: 'Learn 5 verbs per day', intent_en: 'Learn 5 new verbs per day for 14 days' },
    { title_en: 'Read one news article in target language', intent_en: 'Read one news article in the target language daily for 21 days' },
    { title_en: 'Sing along to 5 songs', intent_en: 'Learn to sing along to 5 songs in the target language in 30 days' },
    { title_en: 'Grammar drill 15 min', intent_en: 'Do 15 minutes of grammar drills daily for 21 days' },
    { title_en: 'Label your home', intent_en: 'Label 30 items at home in the target language' },
    { title_en: 'Recipe in target language', intent_en: 'Cook one recipe following instructions in the target language per week for 4 weeks' },
    { title_en: 'Journal 3 sentences daily', intent_en: 'Write 3 sentences in the target language in a journal daily for 21 days' },
    { title_en: 'Watch one film with subs', intent_en: 'Watch one film per week with target-language subtitles for 4 weeks' },
    { title_en: 'Pronunciation drill 5 min', intent_en: 'Practice pronunciation 5 minutes daily for 21 days' },
    { title_en: 'Complete one online lesson daily', intent_en: 'Complete one online lesson per day for 21 days' },
  ],
  CREATE: [
    { title_en: 'Draw one sketch daily', intent_en: 'Draw one sketch every day for 21 days' },
    { title_en: 'Write 300 words daily', intent_en: 'Write 300 words of creative writing every day for 21 days' },
    { title_en: 'One photo challenge per day', intent_en: 'Take one photo following a daily theme for 30 days' },
    { title_en: 'Compose 4 bars of music', intent_en: 'Compose 4 bars of music every day for 14 days' },
    { title_en: 'Doodle 5 minutes daily', intent_en: 'Doodle for 5 minutes every day for 21 days' },
    { title_en: 'Build a small project', intent_en: 'Build one small creative project per week for 4 weeks' },
    { title_en: 'Collage a page per week', intent_en: 'Make one collage page per week for 4 weeks' },
    { title_en: 'Record a short song', intent_en: 'Record one short song per week for 4 weeks' },
    { title_en: 'Write a haiku daily', intent_en: 'Write one haiku every day for 21 days' },
    { title_en: 'Design one logo concept', intent_en: 'Design one logo concept per week for 4 weeks' },
    { title_en: 'Knit or crochet 20 min', intent_en: 'Knit or crochet 20 minutes daily for 21 days' },
    { title_en: 'Film a 1-min clip weekly', intent_en: 'Film one 1-minute clip per week for 4 weeks' },
    { title_en: 'Hand-letter one quote', intent_en: 'Hand-letter one quote per week for 4 weeks' },
    { title_en: 'Bake one new recipe weekly', intent_en: 'Bake one new recipe per week for 4 weeks' },
    { title_en: 'Sew a simple project', intent_en: 'Complete one simple sewing project in 14 days' },
    { title_en: 'Write a short story', intent_en: 'Write one short story (1000 words) in 21 days' },
    { title_en: 'Paint one small canvas', intent_en: 'Paint one small canvas per week for 4 weeks' },
    { title_en: 'Create 5 mood boards', intent_en: 'Create 5 mood boards in 21 days' },
    { title_en: 'Script a 2-min video', intent_en: 'Script and storyboard one 2-minute video in 14 days' },
    { title_en: 'Design a poster', intent_en: 'Design one poster in 7 days' },
    { title_en: 'Pottery or clay 30 min', intent_en: 'Do pottery or clay work 30 minutes per week for 4 weeks' },
  ],
  PERFORM: [
    { title_en: 'Morning routine 5 steps', intent_en: 'Do a 5-step morning routine every day for 21 days' },
    { title_en: 'Evening wind-down 15 min', intent_en: 'Do a 15-minute evening wind-down every day for 21 days' },
    { title_en: 'Weekly review every Sunday', intent_en: 'Do a 30-minute weekly review every Sunday for 4 weeks' },
    { title_en: 'One MIT daily', intent_en: 'Complete one Most Important Task before noon every day for 21 days' },
    { title_en: 'No phone first hour', intent_en: 'No phone for the first hour after waking for 14 days' },
    { title_en: 'Batch emails twice daily', intent_en: 'Check and batch emails only twice per day for 21 days' },
    { title_en: 'Plan next day the night before', intent_en: 'Plan the next day every night for 21 days' },
    { title_en: 'Deep work 90 min block', intent_en: 'Do one 90-minute deep work block daily for 14 days' },
    { title_en: 'Declutter 10 min daily', intent_en: 'Declutter for 10 minutes every day for 21 days' },
    { title_en: 'Single-tasking meals', intent_en: 'Eat without screens for 21 days' },
    { title_en: 'Stand or walk 5 min/hour', intent_en: 'Stand or walk 5 minutes every hour during work for 14 days' },
    { title_en: 'Inbox zero once per week', intent_en: 'Reach inbox zero once per week for 4 weeks' },
    { title_en: 'No meetings before 10am', intent_en: 'Schedule no meetings before 10am for 14 days' },
    { title_en: 'Weekly goals every Monday', intent_en: 'Set 3 weekly goals every Monday for 4 weeks' },
    { title_en: 'Reflect 5 min before bed', intent_en: 'Reflect for 5 minutes before bed for 21 days' },
    { title_en: 'One no-day per week', intent_en: 'Have one no-meeting day per week for 4 weeks' },
    { title_en: 'Batch admin 1 hour weekly', intent_en: 'Batch admin tasks into one 1-hour block per week for 4 weeks' },
    { title_en: 'Desk reset every evening', intent_en: 'Reset your desk every evening for 21 days' },
    { title_en: 'Calendar audit weekly', intent_en: 'Audit your calendar every Sunday for 4 weeks' },
    { title_en: 'Say no to one request', intent_en: 'Say no to one non-essential request per week for 4 weeks' },
    { title_en: 'Wake at same time', intent_en: 'Wake at the same time every day for 21 days' },
  ],
  WELLBEING: [
    { title_en: 'Meditate 10 min daily', intent_en: 'Meditate 10 minutes every day for 21 days' },
    { title_en: 'Gratitude list 3 items', intent_en: 'Write 3 things you are grateful for every day for 21 days' },
    { title_en: 'Stretch 5 min morning', intent_en: 'Stretch for 5 minutes every morning for 21 days' },
    { title_en: 'No screens 1 hour before bed', intent_en: 'No screens 1 hour before bed for 14 days' },
    { title_en: 'Walk 20 min daily', intent_en: 'Walk 20 minutes every day for 21 days' },
    { title_en: 'Drink 8 glasses of water', intent_en: 'Drink 8 glasses of water daily for 21 days' },
    { title_en: 'Breathing exercise 5 min', intent_en: 'Do a 5-minute breathing exercise daily for 21 days' },
    { title_en: 'Sleep by 11pm', intent_en: 'Be in bed by 11pm every night for 14 days' },
    { title_en: 'One healthy meal daily', intent_en: 'Eat one healthy home-cooked meal per day for 21 days' },
    { title_en: 'Journal 5 min', intent_en: 'Journal for 5 minutes every day for 21 days' },
    { title_en: 'Digital sunset 9pm', intent_en: 'Stop using devices after 9pm for 14 days' },
    { title_en: 'Nature 30 min weekly', intent_en: 'Spend 30 minutes in nature once per week for 4 weeks' },
    { title_en: 'Self-compassion phrase', intent_en: 'Repeat one self-compassion phrase daily for 21 days' },
    { title_en: 'Progressive relaxation', intent_en: 'Do progressive muscle relaxation 3 times per week for 4 weeks' },
    { title_en: 'One hobby hour weekly', intent_en: 'Dedicate one hour to a hobby every week for 4 weeks' },
    { title_en: 'Limit caffeine after 2pm', intent_en: 'No caffeine after 2pm for 21 days' },
    { title_en: 'Body scan 10 min', intent_en: 'Do a 10-minute body scan 3 times per week for 4 weeks' },
    { title_en: 'Laugh daily', intent_en: 'Watch or read something that makes you laugh every day for 21 days' },
    { title_en: 'Cold shower 30 sec', intent_en: 'End your shower with 30 seconds of cold water for 14 days' },
    { title_en: 'One screen-free meal', intent_en: 'Eat one meal per day without screens for 21 days' },
    { title_en: 'Sleep log 7 days', intent_en: 'Log your sleep for 7 days' },
  ],
  SOCIAL: [
    { title_en: 'Message one friend weekly', intent_en: 'Message one friend you have not talked to in a while every week for 4 weeks' },
    { title_en: 'One coffee date', intent_en: 'Schedule one coffee or walk with a friend per week for 4 weeks' },
    { title_en: 'Thank you note', intent_en: 'Send one thank you note per week for 4 weeks' },
    { title_en: 'Family call 15 min', intent_en: 'Call a family member for 15 minutes once per week for 4 weeks' },
    { title_en: 'Join one community event', intent_en: 'Join one community or club event in 30 days' },
    { title_en: 'Compliment someone daily', intent_en: 'Give one genuine compliment per day for 21 days' },
    { title_en: 'Host a small gathering', intent_en: 'Host one small gathering in 30 days' },
    { title_en: 'Volunteer 2 hours', intent_en: 'Volunteer 2 hours in 30 days' },
    { title_en: 'Reconnect with 3 people', intent_en: 'Reconnect with 3 people you lost touch with in 30 days' },
    { title_en: 'Listen without phone', intent_en: 'Have one conversation per week with no phone in hand for 4 weeks' },
    { title_en: 'Team lunch or walk', intent_en: 'Do one team lunch or walk per week for 4 weeks' },
    { title_en: 'Introduce two people', intent_en: 'Introduce two people who could benefit from knowing each other in 30 days' },
    { title_en: 'Ask for one piece of advice', intent_en: 'Ask one person for advice per week for 4 weeks' },
    { title_en: 'Celebrate someone', intent_en: 'Celebrate one person per week for 4 weeks' },
    { title_en: 'Group hobby session', intent_en: 'Do one group hobby session in 30 days' },
    { title_en: 'Reply to messages within 24h', intent_en: 'Reply to messages within 24 hours for 14 days' },
    { title_en: 'Share one win weekly', intent_en: 'Share one small win with a friend or family per week for 4 weeks' },
    { title_en: 'No phone at dinner', intent_en: 'No phone at dinner with others for 21 days' },
    { title_en: 'Mentor or be mentored', intent_en: 'Have one mentoring conversation in 30 days' },
    { title_en: 'Plan a reunion', intent_en: 'Plan one small reunion in 60 days' },
    { title_en: 'Support a friend project', intent_en: 'Support one friend project in 30 days' },
  ],
  CHALLENGE: [
    { title_en: '30-day no sugar', intent_en: 'No added sugar for 30 days' },
    { title_en: '30-day no social media', intent_en: 'No social media for 30 days' },
    { title_en: '7-day cold shower', intent_en: 'Cold shower every day for 7 days' },
    { title_en: '21-day early wake', intent_en: 'Wake at 6am every day for 21 days' },
    { title_en: '14-day no alcohol', intent_en: 'No alcohol for 14 days' },
    { title_en: '30-day no takeout', intent_en: 'No takeout for 30 days' },
    { title_en: '21-day no complaining', intent_en: 'No complaining for 21 days' },
    { title_en: '7-day digital detox', intent_en: 'No non-essential screens for 7 days' },
    { title_en: '30-day 10k steps', intent_en: 'Walk 10,000 steps every day for 30 days' },
    { title_en: '14-day no snooze', intent_en: 'No snooze button for 14 days' },
    { title_en: '21-day no fast food', intent_en: 'No fast food for 21 days' },
    { title_en: '30-day daily journal', intent_en: 'Journal every day for 30 days' },
    { title_en: '7-day no TV', intent_en: 'No TV for 7 days' },
    { title_en: '21-day one book', intent_en: 'Finish one book in 21 days' },
    { title_en: '30-day gratitude', intent_en: 'Write 3 gratitudes every day for 30 days' },
    { title_en: '14-day no caffeine', intent_en: 'No caffeine for 14 days' },
    { title_en: '21-day plank challenge', intent_en: 'Increase plank time daily for 21 days' },
    { title_en: '30-day save challenge', intent_en: 'Save a fixed amount every day for 30 days' },
    { title_en: '7-day kindness challenge', intent_en: 'Do one extra act of kindness per day for 7 days' },
    { title_en: '21-day no online shopping', intent_en: 'No online shopping for 21 days' },
    { title_en: '30-day learn one skill', intent_en: 'Practice one new skill 15 min daily for 30 days' },
  ],
};

function seed() {
  const dir = path.dirname(tablePath);
  if (!fs.existsSync(path.join(root, 'apps/web/app/PourLaMaquette/db/tables'))) {
    fs.mkdirSync(path.join(root, 'apps/web/app/PourLaMaquette/db/tables'), { recursive: true });
  }
  if (!fs.existsSync(path.join(root, 'apps/web/app/PourLaMaquette/db/indexes'))) {
    fs.mkdirSync(path.join(root, 'apps/web/app/PourLaMaquette/db/indexes'), { recursive: true });
  }
  const now = new Date().toISOString();
  const rows = [];
  const index = {};
  let idSeq = 0;
  for (const [category, items] of Object.entries(SEED_BY_CATEGORY)) {
    for (const item of items) {
      const id = `idea-${category.toLowerCase()}-${String(idSeq++).padStart(4, '0')}`;
      const record = {
        id,
        category,
        canonical_lang: 'en',
        title_en: item.title_en,
        intent_en: item.intent_en,
        created_at: now,
        updated_at: now,
        source: 'seed',
      };
      rows.push(record);
      index[id] = { id, category, updated_at: now };
    }
  }
  fs.writeFileSync(tablePath, rows.map((r) => JSON.stringify(r)).join('\n') + '\n', 'utf-8');
  fs.writeFileSync(indexPath, JSON.stringify(index, null, 2) + '\n', 'utf-8');
  console.log('Seeded', rows.length, 'idea routines to', tablePath);
}

seed();
