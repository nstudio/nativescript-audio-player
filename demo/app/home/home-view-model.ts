import { AudioPlayer, AudioPlayerEvents, AudioPlayerOptions } from '@nstudio/nativescript-audio-player';
import { Observable } from 'tns-core-modules/data/observable';
import * as timer from 'tns-core-modules/timer';
import * as dialogs from 'tns-core-modules/ui/dialogs';
import { Page } from 'tns-core-modules/ui/page';
import { Slider } from 'tns-core-modules/ui/slider';
import { Prop } from '../prop';

export class HomeViewModel extends Observable {
  @Prop() public isPlaying: boolean;
  @Prop() public currentVolume;
  @Prop() public audioTrackDuration;
  @Prop() public remainingDuration; // used to show the remaining time of the audio track
  private _player: AudioPlayer;
  private _audioSessionId;
  private _page;
  private _audioUrls: Array<any> = [
    {
      name: 'Fight Club',
      pic: '~/pics/canoe_girl.jpeg',
      url: 'http://www.noiseaddicts.com/samples_1w72b820/2514.mp3'
    },
    {
      name: 'To The Bat Cave!!!',
      pic: '~/pics/bears.jpeg',
      url: 'http://www.noiseaddicts.com/samples_1w72b820/17.mp3'
    },
    {
      name: 'Marlon Brando',
      pic: '~/pics/northern_lights.jpeg',
      url: 'http://www.noiseaddicts.com/samples_1w72b820/47.mp3'
    }
  ];
  private _meterInterval: any;
  private _slider: Slider;
  private _durationTrackingInterval;
  private _volumeTrackingInterval;

  constructor(page: Page) {
    super();
    this._player = new AudioPlayer();
    this._player.events.on(AudioPlayerEvents.ready, args => {
      console.log('AudioPlayer Ready event executed...');
    });

    this.currentVolume = 1;
    this._slider = page.getViewById('volumeSlider') as Slider;

    // Set player volume
    if (this._slider) {
      this._slider.on('valueChange', (data: any) => {
        this._player.volume = this._slider.value / 100;
      });
    }
  }

  /***** AUDIO PLAYER *****/

  public async playAudio(filepath: string, fileType: string) {
    try {
      const playerOptions: AudioPlayerOptions = {
        autoPlay: true,
        audioFile: filepath,
        loop: false,
        completeCallback: async () => {
          alert('Audio file complete.');
          await this._player.dispose();
          this.isPlaying = false;
          console.log('player disposed');
        },
        errorCallback: errorObject => {
          console.log(JSON.stringify(errorObject));
          this.isPlaying = false;
        },
        infoCallback: args => {
          dialogs.alert('Info callback: ' + args.info);
          console.log(JSON.stringify(args));
        }
      };

      this.isPlaying = true;

      if (fileType === 'localFile') {
        await this._player.playFromFile(playerOptions).catch(() => {
          this.isPlaying = false;
        });
        this.isPlaying = true;
        // start audio duration tracking
        this._startDurationTracking();
        this._startVolumeTracking();
      } else if (fileType === 'remoteFile') {
        await this._player.playFromUrl(playerOptions).catch(() => {
          this.isPlaying = false;
        });
        this.isPlaying = true;
      }
    } catch (ex) {
      console.log(ex);
    }
  }

  /**
   * PLAY REMOTE AUDIO FILE
   */
  public playRemoteFile() {
    console.log('playRemoteFile');
    // const filepath = 'http://www.noiseaddicts.com/samples_1w72b820/2514.mp3';
    const filepath = 'https://edge1-b.exa.live365.net/a88164'; // not playing consistently
    // const filepath = 'http://74.208.89.18:8000/SLCR_highdef.mp3';

    this.playAudio(filepath, 'remoteFile');
  }

  public resumePlayer() {
    this._player.resume();
  }

  /**
   * PLAY LOCAL AUDIO FILE from app folder
   */
  public playLocalFile() {
    const filepath = '~/audio/angel.mp3';
    this.playAudio(filepath, 'localFile');
  }

  /**
   * PAUSE PLAYING
   */
  public async pauseAudio() {
    try {
      await this._player.pause();
      this.isPlaying = false;
    } catch (error) {
      console.log(error);
      this.isPlaying = true;
    }
  }

  public async stopPlaying() {
    await this._player.dispose();
    timer.clearInterval(this._volumeTrackingInterval);
    timer.clearInterval(this._durationTrackingInterval);
    alert('Media Player Disposed.');
  }

  /**
   * RESUME PLAYING
   */
  public resumePlaying() {
    console.log('START');
    this._player.play();
  }

  public muteTap() {
    this._player.volume = 0;
  }

  public unmuteTap() {
    this._player.volume = 1;
  }

  public skipTo8() {
    this._player.seekTo(8);
  }

  public playSpeed1() {
    this._player.changePlayerSpeed(1);
  }

  public playSpeed15() {
    this._player.changePlayerSpeed(1.5);
  }

  public playSpeed2() {
    this._player.changePlayerSpeed(2);
  }

  private async _startDurationTracking() {
    this._durationTrackingInterval = timer.setInterval(() => {
      // set the duratio for the UI binded value
      this.audioTrackDuration = this._player.duration;
      // calculate the remaining duration by subtracting current time of player
      this.remainingDuration =
        this.audioTrackDuration - this._player.currentTime;
    }, 2000);
  }

  private _startVolumeTracking() {
    this._volumeTrackingInterval = timer.setInterval(() => {
      this.currentVolume = this._player.volume;
    }, 1000);
  }
}
