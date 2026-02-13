import React from 'react';
import BonusWheelEditor from './BonusWheelEditor';
import StarsProductEditor from './StarsProductEditor';
import GameFlappyEditor from './GameFlappyEditor';
import StylesPassportEditor from './StylesPassportEditor';
import CalendarBookingEditor from './CalendarBookingEditor';
import SalesQrEditor from './SalesQrEditor';

import JsonPropsEditor from './JsonPropsEditor';

// сюда потом добавим styles_passport_one / game_flappy_one / calendar_booking_one и т.д.
export function getEditorForKey(key: string){
  if (key === 'bonus_wheel_one') return BonusWheelEditor;
  if (key === 'shop_stars_product_one') return StarsProductEditor;
if (key === 'game_flappy_one') return GameFlappyEditor;
  if (key === 'styles_passport_one') return StylesPassportEditor;
  if (key === 'calendar_booking_one') return CalendarBookingEditor;
  if (key === 'sales_qr_one') return SalesQrEditor;

  
  return JsonPropsEditor;
}
