import { Observable } from 'tns-core-modules/data/observable';
import { TNSPlayerI } from './player.common';
export declare class AudioPlayer implements TNSPlayerI {
  private _player;
  private _mAudioFocusGranted;
  private _lastPlayerVolume;
  private _events;
  readonly events: Observable;
  readonly android: android.media.MediaPlayer;
  volume: number;
  readonly duration: number;
  readonly currentTime: number;
  constructor();
  pause(): Promise<boolean>;
  play(): Promise<boolean>;
  resume(): void;
  seekTo(time: number): Promise<any>;
  changePlayerSpeed(speed: any): void;
  dispose(): Promise<any>;
  isAudioPlaying(): boolean;
  getAudioTrackDuration(): Promise<string>;
  private _sendEvent;
  private _requestAudioFocus;
  private _abandonAudioFocus;
  private _getAndroidContext;
  private _mOnAudioFocusChangeListener;
}
