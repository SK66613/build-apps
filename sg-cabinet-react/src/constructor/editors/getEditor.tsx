import React from 'react';
import BonusWheelEditor from './BonusWheelEditor';
import StarsProductEditor from './StarsProductEditor';
import GameFlappyEditor from './GameFlappyEditor';


import JsonPropsEditor from './JsonPropsEditor';

// сюда потом добавим styles_passport_one / game_flappy_one / calendar_booking_one и т.д.
export function getEditorForKey(key: string){
  if (key === 'bonus_wheel_one') return BonusWheelEditor;
  if (key === 'shop_stars_product_one') return StarsProductEditor;

  if (key === 'game_flappy_one') return GameFlappyEditor;

  
  return JsonPropsEditor;
}
