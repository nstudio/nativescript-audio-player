import * as fs from 'tns-core-modules/file-system';
import { isString } from 'tns-core-modules/utils/types';

export const LOG_DEBUG = '@nstudio/nativescript-audio-player --- DEBUG:';
export const LOG_ERROR = '@nstudio/nativescript-audio-player --- ERROR:';

export interface TNSPlayerI {
  /**
   * native instance getters
   */
  readonly ios?: any;
  readonly android?: any;

  /**
   * Volume getter/setter
   */
  volume: any;

  /**
   * Play audio file.
   */
  play(): Promise<boolean>;

  /**
   * Pauses playing audio file.
   */
  pause(): Promise<boolean>;

  /**
   * Seeks to specific time.
   */
  seekTo(time: number): Promise<boolean>;

  /**
   * Releases resources from the audio player.
   */
  dispose(): Promise<boolean>;

  /**
   * Check if the audio is actively playing.
   */
  isAudioPlaying(): boolean;

  /**
   * Get the duration of the audio file playing.
   */
  getAudioTrackDuration(): Promise<string>;

  /**
   * current time
   */
  readonly currentTime: number;
}

/**
 * Provides options for the audio player.
 */
export interface AudioPlayerOptions {
  /**
   * Gets or sets the audio file url.
   */
  audioFile: string;

  /**
   * Gets or sets the callback when the currently playing audio file completes.
   * @returns {Object} An object containing the native values for the callback.
   */
  completeCallback?: Function;

  /**
   * Get or sets the player to loop playback.
   */
  loop: boolean;

  /**
   * Prevent autoplay if desired as player autoplays be default
   */
  autoPlay?: boolean;

  /**
   * Enable metering. Off by default.
   */
  metering?: boolean;

  /**
   * Gets or sets the callback when an error occurs with the audio player.
   * @returns {Object} An object containing the native values for the error callback.
   */
  errorCallback?: Function;

  /**
   * Gets or sets the callback to be invoked to communicate some info and/or warning about the media or its playback.
   * @returns {Object} An object containing the native values for the info callback.
   */
  infoCallback?: Function;
}

export enum AudioPlayerEvents {
  SEEK = 'seek',
  PAUSED = 'paused',
  STARTED = 'started',
  READY = 'ready'
}

/**
 * Helper function to determine if string is a url.
 * @param value [string]
 */
export function isStringUrl(value: string): boolean {
  // check if artURL is a url or local file
  let isURL = false;
  if (value.indexOf('://') !== -1) {
    if (value.indexOf('res://') === -1) {
      isURL = true;
    }
  }
  if (isURL === true) {
    return true;
  } else {
    return false;
  }
}

/**
 * Will determine if a string is a url or a local path. If the string is a url it will return the url.
 * If it is a local path, then the file-system module will return the file system path.
 * @param path [string]
 */
export function resolveAudioFilePath(path: string) {
  if (path) {
    const isUrl = isStringUrl(path);
    // if it's a url just return the audio file url
    if (isUrl === true) {
      return path;
    } else {
      let audioPath;
      let fileName = isString(path) ? path.trim() : '';
      if (fileName.indexOf('~/') === 0) {
        fileName = fs.path.join(
          fs.knownFolders.currentApp().path,
          fileName.replace('~/', '')
        );
        audioPath = fileName;
      } else {
        audioPath = fileName;
      }
      return audioPath;
    }
  }
}
