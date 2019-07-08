import * as app from 'tns-core-modules/application';
import { Observable } from 'tns-core-modules/data/observable';
import { AudioPlayerEvents, LOG_DEBUG, TNSPlayerI } from './player.common';

export class AudioPlayer implements TNSPlayerI {
  private _player: android.media.MediaPlayer;
  private _mAudioFocusGranted: boolean = false;
  private _lastPlayerVolume; // ref to the last volume setting so we can reset after ducking
  private _events: Observable;

  get events() {
    if (!this._events) {
      this._events = new Observable();
    }
    return this._events;
  }

  get android(): android.media.MediaPlayer {
    return this._player;
  }

  get volume(): number {
    // TODO: find better way to get individual player volume
    const ctx = this._getAndroidContext();
    const mgr = ctx.getSystemService(android.content.Context.AUDIO_SERVICE);
    return mgr.getStreamVolume(android.media.AudioManager.STREAM_MUSIC);
  }

  set volume(value: number) {
    if (this._player && value >= 0) {
      this._player.setVolume(value, value);
    }
  }

  public get duration(): number {
    if (this._player) {
      return this._player.getDuration();
    } else {
      return 0;
    }
  }

  get currentTime(): number {
    return this._player ? this._player.getCurrentPosition() : 0;
  }

  constructor() {
    // request audio focus, this will setup the onAudioFocusChangeListener
    this._mAudioFocusGranted = this._requestAudioFocus();
    console.log(LOG_DEBUG, '_mAudioFocusGranted', this._mAudioFocusGranted);
  }

  public pause(): Promise<boolean> {
    return new Promise((resolve, reject) => {
      if (this._player && this._player.isPlaying()) {
        console.log(LOG_DEBUG, 'pausing player');
        this._player.pause();
        this._sendEvent(AudioPlayerEvents.PAUSED);
        resolve(true);
      } else {
        resolve(false);
      }
    });
  }

  public play(): Promise<boolean> {
    return new Promise((resolve, reject) => {
      try {
        if (this._player && !this._player.isPlaying()) {
          this._sendEvent(AudioPlayerEvents.STARTED);
          // set volume controls
          // https://developer.android.com/reference/android/app/Activity.html#setVolumeControlStream(int)
          app.android.foregroundActivity.setVolumeControlStream(
            android.media.AudioManager.STREAM_MUSIC
          );

          // register the receiver so when calls or another app takes main audio focus the player pauses
          app.android.registerBroadcastReceiver(
            android.media.AudioManager.ACTION_AUDIO_BECOMING_NOISY,
            (
              context: android.content.Context,
              intent: android.content.Intent
            ) => {
              console.log(
                LOG_DEBUG,
                'ACTION_AUDIO_BECOMING_NOISY onReceiveCallback'
              );
              console.log(LOG_DEBUG, 'intent', intent);
              this.pause();
            }
          );

          this._player.start();
        }
        resolve(true);
      } catch (ex) {
        console.log(LOG_DEBUG, 'Error trying to play audio.', ex);
        reject(ex);
      }
    });
  }

  public resume(): void {
    if (this._player) {
      console.log(LOG_DEBUG, 'resume');
      this._player.start();
      this._sendEvent(AudioPlayerEvents.STARTED);
    }
  }

  public seekTo(time: number): Promise<any> {
    return new Promise((resolve, reject) => {
      if (this._player) {
        time = time * 1000;
        console.log(LOG_DEBUG, 'seekTo seconds', time);
        this._player.seekTo(time);
        this._sendEvent(AudioPlayerEvents.SEEK);
        resolve(true);
      } else {
        resolve(false);
      }
    });
  }

  public changePlayerSpeed(speed) {
    // this checks on API 23 and up
    if (android.os.Build.VERSION.SDK_INT >= 23 && this._player) {
      console.log(LOG_DEBUG, 'setting the mediaPlayer playback speed', speed);
      if (this._player.isPlaying()) {
        this._player.setPlaybackParams(
          this._player.getPlaybackParams().setSpeed(speed)
        );
      } else {
        this._player.setPlaybackParams(
          this._player.getPlaybackParams().setSpeed(speed)
        );
        this._player.pause();
      }
    } else {
      console.log(
        LOG_DEBUG,
        'Android device API is not 23+. Cannot set the playbackRate on lower Android APIs.'
      );
    }
  }

  public dispose(): Promise<any> {
    return new Promise((resolve, reject) => {
      try {
        if (this._player) {
          console.log(
            LOG_DEBUG,
            'disposing of mediaPlayer instance',
            this._player
          );
          this._player.stop();
          this._player.reset();
          // this._player.release();

          console.log(
            LOG_DEBUG,
            'unregisterBroadcastReceiver ACTION_AUDIO_BECOMING_NOISY...'
          );
          // unregister broadcast receiver
          app.android.unregisterBroadcastReceiver(
            android.media.AudioManager.ACTION_AUDIO_BECOMING_NOISY
          );

          console.log(LOG_DEBUG, 'abandoning audio focus...');
          this._abandonAudioFocus();
        }
        resolve();
      } catch (ex) {
        console.log(LOG_DEBUG, 'dispose error', ex);
        reject(ex);
      }
    });
  }

  public isAudioPlaying(): boolean {
    if (this._player) {
      return this._player.isPlaying();
    } else {
      return false;
    }
  }

  public getAudioTrackDuration(): Promise<string> {
    return new Promise((resolve, reject) => {
      const duration = this._player ? this._player.getDuration() : 0;
      console.log(LOG_DEBUG, 'audio track duration', duration);
      resolve(duration.toString());
    });
  }

  /**
   * Notify events by name and optionally pass data
   */
  private _sendEvent(eventName: string, data?: any) {
    if (this.events) {
      this.events.notify(<any>{
        eventName,
        object: this,
        data: data
      });
    }
  }

  /**
   * Helper method to ensure audio focus.
   */
  private _requestAudioFocus(): boolean {
    let result = false;
    if (!this._mAudioFocusGranted) {
      const ctx = this._getAndroidContext();
      const am = ctx.getSystemService(android.content.Context.AUDIO_SERVICE);
      // Request audio focus for play back
      const focusResult = am.requestAudioFocus(
        this._mOnAudioFocusChangeListener,
        android.media.AudioManager.STREAM_MUSIC,
        android.media.AudioManager.AUDIOFOCUS_GAIN
      );

      if (
        focusResult === android.media.AudioManager.AUDIOFOCUS_REQUEST_GRANTED
      ) {
        result = true;
      } else {
        console.log(LOG_DEBUG, 'Failed to get audio focus.');
        result = false;
      }
    }
    return result;
  }

  private _abandonAudioFocus(): void {
    const ctx = this._getAndroidContext();
    const am = ctx.getSystemService(android.content.Context.AUDIO_SERVICE);
    const result = am.abandonAudioFocus(this._mOnAudioFocusChangeListener);
    if (result === android.media.AudioManager.AUDIOFOCUS_REQUEST_GRANTED) {
      this._mAudioFocusGranted = false;
    } else {
      console.log(LOG_DEBUG, 'Failed to abandon audio focus.');
    }
    this._mOnAudioFocusChangeListener = null;
  }

  private _getAndroidContext() {
    let ctx = app.android.context;
    if (!ctx) {
      ctx = app.getNativeApplication().getApplicationContext();
    }

    if (ctx === null) {
      setTimeout(() => {
        this._getAndroidContext();
      }, 200);

      return;
    }

    return ctx;
  }

  private _mOnAudioFocusChangeListener = new android.media.AudioManager.OnAudioFocusChangeListener(
    {
      onAudioFocusChange: (focusChange: number) => {
        switch (focusChange) {
          case android.media.AudioManager.AUDIOFOCUS_GAIN:
            console.log(LOG_DEBUG, 'AUDIOFOCUS_GAIN');
            // Set volume level to desired levels
            console.log(
              LOG_DEBUG,
              'this._lastPlayerVolume',
              this._lastPlayerVolume
            );
            // if last volume more than 10 just set to 1.0 float
            if (this._lastPlayerVolume && this._lastPlayerVolume >= 10) {
              this.volume = 1.0;
            } else if (this._lastPlayerVolume) {
              this.volume = parseFloat(
                '0.' + this._lastPlayerVolume.toString()
              );
            }

            this.resume();
            break;
          case android.media.AudioManager.AUDIOFOCUS_GAIN_TRANSIENT:
            console.log(LOG_DEBUG, 'AUDIOFOCUS_GAIN_TRANSIENT');
            // You have audio focus for a short time
            break;
          case android.media.AudioManager.AUDIOFOCUS_LOSS:
            console.log(LOG_DEBUG, 'AUDIOFOCUS_LOSS');
            this.pause();
            break;
          case android.media.AudioManager.AUDIOFOCUS_LOSS_TRANSIENT:
            console.log(LOG_DEBUG, 'AUDIOFOCUS_LOSS_TRANSIENT');
            // Temporary loss of audio focus - expect to get it back - you can keep your resources around
            this.pause();
            break;
          case android.media.AudioManager.AUDIOFOCUS_LOSS_TRANSIENT_CAN_DUCK:
            console.log(LOG_DEBUG, 'AUDIOFOCUS_LOSS_TRANSIENT_CAN_DUCK');
            // Lower the volume, keep playing
            this._lastPlayerVolume = this.volume;
            console.log(
              LOG_DEBUG,
              'this._lastPlayerVolume',
              this._lastPlayerVolume
            );
            this.volume = 0.2;
            break;
        }
      }
    }
  );
}
