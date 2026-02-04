import { WheelEditor } from "./wheel/WheelEditor";
import { PassportEditor } from "./passport/PassportEditor";
import { CalendarEditor } from "./calendar/CalendarEditor";
import { FlappyEditor } from "./flappy/FlappyEditor";

export const BlockEditors: Record<string, any> = {
  bonus_wheel_one: WheelEditor,
  styles_passport_one: PassportEditor,
  calendar_booking_one: CalendarEditor,
  game_flappy_one: FlappyEditor,
};