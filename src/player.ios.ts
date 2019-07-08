import { Observable } from 'tns-core-modules/data/observable';
import { knownFolders, path } from 'tns-core-modules/file-system';
import { isString } from 'tns-core-modules/utils/types';
import { AudioPlayerEvents, AudioPlayerOptions, LOG_DEBUG, TNSPlayerI } from './player.common';

export class AudioPlayer extends NSObject implements TNSPlayerI {
  private _player: AVPlayer;
  private _events: Observable;

  /**
   * Status Observer is for watching the status of the AVPlayerItem to know if playback is ready or not.
   */
  private _statusObserver;
  private _statusObserverActive: boolean;

  get events() {
    if (!this._events) {
      this._events = new Observable();
    }
    return this._events;
  }

  get ios(): any {
    return this._player;
  }

  get volume(): number {
    return this._player ? this._player.volume : 0;
  }

  set volume(value: number) {
    if (this._player && value >= 0) {
      this._player.volume = value;
    }
  }

  get duration() {
    if (this._player && this._player.currentItem) {
      const seconds = CMTimeGetSeconds(this._player.currentItem.asset.duration);
      const milliseconds = seconds * 1000.0;
      return milliseconds;
    } else {
      return 0;
    }
  }

  get currentTime(): number {
    if (this._player && this._player.currentItem) {
      return (
        (this._player.currentTime().value /
          this._player.currentTime().timescale) *
        1000
      );
    } else {
      return 0;
    }
  }

  initFromFile(options: AudioPlayerOptions): Promise<any> {
    return new Promise((resolve, reject) => {
      // init only
      options.autoPlay = false;
      this.playFromFile(options).then(resolve, reject);
    });
  }

  playFromFile(options: AudioPlayerOptions): Promise<any> {
    return new Promise((resolve, reject) => {
      try {
        this._statusObserver = PlayerObserverClass.alloc();
        this._statusObserver['_owner'] = this;

        let fileName = isString(options.audioFile)
          ? options.audioFile.trim()
          : '';
        if (fileName.indexOf('~/') === 0) {
          fileName = path.join(
            knownFolders.currentApp().path,
            fileName.replace('~/', '')
          );
        }
        console.log(LOG_DEBUG, 'fileName', fileName);

        this._setIOSAudioSessionOutput();
        this._setupPlayerItem(fileName, true);

        if (options.loop) {
          // Invoke after player is created and AVPlayerItem is specified
          NSNotificationCenter.defaultCenter.addObserverSelectorNameObject(
            this,
            'playerItemDidReachEnd',
            AVPlayerItemDidPlayToEndTimeNotification,
            this._player.currentItem
          );
        }

        if (options.autoPlay) {
          this._player.play();
        }

        resolve();
      } catch (ex) {
        reject(ex);
      }
    });
  }

  playerItemDidReachEnd() {
    if (this._player) {
      this._player.seekToTime(kCMTimeZero);
      this._player.play();
    }
  }

  initFromUrl(options: AudioPlayerOptions): Promise<any> {
    return new Promise((resolve, reject) => {
      // init only
      options.autoPlay = false;
      this.playFromUrl(options).then(resolve, reject);
    });
  }

  playFromUrl(options: AudioPlayerOptions): Promise<any> {
    return new Promise((resolve, reject) => {
      try {
        this._statusObserver = PlayerObserverClass.alloc();
        this._statusObserver['_owner'] = this;

        this._setIOSAudioSessionOutput();
        this._setupPlayerItem(options.audioFile, false);

        resolve();
      } catch (ex) {
        reject(ex);
      }
    });
  }

  pause(): Promise<any> {
    return new Promise((resolve, reject) => {
      try {
        if (
          this._player &&
          this._player.timeControlStatus === AVPlayerTimeControlStatus.Playing
        ) {
          console.log(LOG_DEBUG, 'pausing player...');
          this._player.pause();
          resolve(true);
        }
      } catch (ex) {
        console.log(LOG_DEBUG, 'pause error', ex);
        reject(ex);
      }
    });
  }

  play(): Promise<any> {
    return new Promise((resolve, reject) => {
      try {
        if (!this.isAudioPlaying()) {
          console.log(LOG_DEBUG, 'player play...');
          this._player.play();
          resolve(true);
        }
      } catch (ex) {
        console.log(LOG_DEBUG, 'play error', ex);
        reject(ex);
      }
    });
  }

  resume(): void {
    if (this._player && this._player.currentItem) {
      console.log(LOG_DEBUG, 'resuming player...');
      this._player.play();
    }
  }

  playAtTime(time: number): void {
    if (this._player && this._player.currentItem) {
      console.log(LOG_DEBUG, 'playAtTime', time);
      this._player.seekToTime(CMTimeMakeWithSeconds(time, 1000));
    }
  }

  seekTo(time: number): Promise<any> {
    return new Promise((resolve, reject) => {
      try {
        if (
          this._player.currentItem &&
          this._player.currentItem.status === AVPlayerItemStatus.ReadyToPlay
        ) {
          console.log(LOG_DEBUG, 'seekTo', time);
          this._player.seekToTime(CMTimeMakeWithSeconds(time, 1000));
          resolve(true);
        }
      } catch (ex) {
        console.log(LOG_DEBUG, 'seekTo error', ex);
        reject(ex);
      }
    });
  }

  dispose(): Promise<any> {
    return new Promise((resolve, reject) => {
      try {
        console.log(LOG_DEBUG, 'disposing TNSPlayer...');

        if (this._player) {
          // remove the status observer from the AVPlayerItem
          if (this._player.currentItem) {
            this._removeStatusObserver(this._player.currentItem);
          }

          this._player.pause();
          this._player.replaceCurrentItemWithPlayerItem(null); // de-allocates the AVPlayer
          this._player = null;
        }

        resolve();
      } catch (ex) {
        console.log(LOG_DEBUG, 'dispose error', ex);
        reject(ex);
      }
    });
  }

  isAudioPlaying(): boolean {
    return this._player &&
      this._player.timeControlStatus === AVPlayerTimeControlStatus.Playing
      ? true
      : false;
  }

  getAudioTrackDuration(): Promise<string> {
    return new Promise((resolve, reject) => {
      try {
        const seconds = CMTimeGetSeconds(
          this._player.currentItem.asset.duration
        );
        const milliseconds = seconds * 1000.0;
        console.log(LOG_DEBUG, 'audio track duration', milliseconds);
        resolve(milliseconds.toString());
      } catch (ex) {
        console.log(LOG_DEBUG, 'getAudioTrackDuration error', ex);
        reject(ex);
      }
    });
  }

  changePlayerSpeed(speed) {
    if (this._player && speed) {
      // make sure speed is a number/float
      if (typeof speed === 'string') {
        speed = parseFloat(speed);
      }
      this._player.rate = speed;
    }
  }

  //  audioPlayerDidFinishPlayingSuccessfully(player?: any, flag?: boolean) {
  //   if (flag && this._completeCallback) {
  //     this._completeCallback({ player, flag });
  //   } else if (!flag && this._errorCallback) {
  //     this._errorCallback({ player, flag });
  //   }
  // }

  //  audioPlayerDecodeErrorDidOccurError(player: any, error: NSError) {
  //   if (this._errorCallback) {
  //     this._errorCallback({ player, error });
  //   }
  // }

  /**
   * Notify events by name and optionally pass data
   */
  _sendEvent(eventName: string, data?: any) {
    if (this.events) {
      this.events.notify(<any>{
        eventName,
        object: this,
        data: data
      });
    }
  }

  private _setupPlayerItem(audioUrl, isLocalFile: boolean) {
    let url;
    if (isLocalFile) {
      url = NSURL.fileURLWithPath(audioUrl);
    } else {
      url = NSURL.URLWithString(audioUrl);
    }

    const avAsset = AVURLAsset.URLAssetWithURLOptions(url, null);
    const playerItem = AVPlayerItem.playerItemWithAsset(avAsset);

    // replace the current AVPlayerItem if the player already exists
    if (this._player && this._player.currentItem) {
      this._player.replaceCurrentItemWithPlayerItem(playerItem);
    } else {
      this._player = AVPlayer.playerWithPlayerItem(playerItem);
      // @link - https://stackoverflow.com/a/42628097/1893557
      this._player.automaticallyWaitsToMinimizeStalling = false;
    }

    // setup the status observer for the AVPlayerItem
    this._addStatusObserver(playerItem);
  }

  private _setIOSAudioSessionOutput() {
    const audioSession = AVAudioSession.sharedInstance();
    const output = audioSession.currentRoute.outputs.lastObject.portType;
    console.log(LOG_DEBUG, 'output', output);

    if (output.match(/Receiver/)) {
      try {
        audioSession.setCategoryError(AVAudioSessionCategoryPlayAndRecord);
        audioSession.overrideOutputAudioPortError(
          AVAudioSessionPortOverride.Speaker
        );
        audioSession.setActiveError(true);
        console.log(LOG_DEBUG, 'audioSession category set and active');
      } catch (err) {
        console.log(LOG_DEBUG, 'setting audioSession category failed');
      }
    }
  }

  private _addStatusObserver(currentItem: AVPlayerItem) {
    this._statusObserverActive = true;
    currentItem.addObserverForKeyPathOptionsContext(
      this._statusObserver,
      'status',
      0,
      null
    );
  }

  private _removeStatusObserver(currentItem: AVPlayerItem) {
    // If the observer is active, then we need to remove it...
    if (!this._statusObserverActive) {
      return;
    }

    this._statusObserverActive = false;
    if (currentItem) {
      currentItem.removeObserverForKeyPath(this._statusObserver, 'status');
    }
  }
}

class PlayerObserverClass extends NSObject {
  observeValueForKeyPathOfObjectChangeContext(
    path: string,
    obj: Object,
    change: NSDictionary<any, any>,
    context: any
  ) {
    if (path === 'status') {
      if (
        this['_owner']._player.currentItem.status ===
        AVPlayerItemStatus.ReadyToPlay
      ) {
        // send the ready event
        this['_owner']._sendEvent(AudioPlayerEvents.READY);
        // if playing url, we need to call play here
        this['_owner']._player.play();
      }
    }
  }
}
