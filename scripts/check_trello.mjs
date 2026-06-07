import 'dotenv/config';
import fetch from 'node-fetch';

const key = process.env.TRELLO_API_KEY;
const token = process.env.TRELLO_API_TOKEN;
const board = process.env.TRELLO_BOARD_IDS?.split(',')[0];
const base = 'https://api.trello.com/1';

if (!key || !token || !board) {
  console.error('Missing TRELLO_API_KEY, TRELLO_API_TOKEN or TRELLO_BOARD_IDS');
  process.exit(1);
}

const get = async (path) => {
  const url = `${base}${path}&key=${key}&token=${token}`;
  const res = await fetch(url);
  console.log('GET', path, res.status);
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`HTTP ${res.status}: ${body}`);
  }
  return res.json();
};

const run = async () => {
  const lists = await get(`/boards/${board}/lists?fields=name,id&cards=none`);
  console.log('lists', lists.map((l) => ({ id: l.id, name: l.name })));
  for (const l of lists) {
    const cards = await get(`/lists/${l.id}/cards?fields=name,labels,idList,desc`);
    console.log('LIST', l.name, 'cards', cards.map((c) => ({ id: c.id, name: c.name, labels: c.labels.map((x) => x.name) })));
  }
};

run().catch((err) => {
  console.error(err);
  process.exit(1);
});