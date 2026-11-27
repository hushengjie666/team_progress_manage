export const species = { penguin: "小企鹅", cat: "小橘猫", shiba: "小柴犬" } as const;
export type Species = keyof typeof species;

export const foods = [
  { id: "berry", name: "浆果饼干", points: 10, price: 24 },
  { id: "bun", name: "南瓜小包", points: 25, price: 60 },
  { id: "soup", name: "暖心浓汤", points: 50, price: 120 },
  { id: "feast", name: "丰收大餐", points: 100, price: 240 },
] as const;
export type Food = typeof foods[number]["id"];

export const outfits = [
  { id: "leaf", name: "新芽发夹", slot: "head", price: 120 },
  { id: "beret", name: "莓果贝雷帽", slot: "head", price: 360 },
  { id: "crown", name: "晨光皇冠", slot: "head", price: 960 },
  { id: "vest", name: "湖绿马甲", slot: "body", price: 180 },
  { id: "sailor", name: "海风水手服", slot: "body", price: 480 },
  { id: "cape", name: "星夜斗篷", slot: "body", price: 720 },
  { id: "bow", name: "珊瑚领结", slot: "charm", price: 120 },
  { id: "bell", name: "金铃项链", slot: "charm", price: 240 },
  { id: "satchel", name: "旅行挎包", slot: "charm", price: 600 },
] as const;
export type Outfit = typeof outfits[number]["id"];
export type Slot = typeof outfits[number]["slot"];
export const slots = { head: "头饰", body: "服饰", charm: "配饰" } as const;
