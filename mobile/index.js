import { Platform } from 'react-native';
import { registerRootComponent } from 'expo';

import App from './App';
// Importing this registers the background sync task (TaskManager.defineTask)
// at module scope, which is required before the OS can run it headlessly.
import './src/lib/backgroundSync';
import { registerSavingsWidgetHandler } from './src/widgets/widget-task-handler';

// react-native-android-widget is Android-only -- there is no iOS home-screen
// widget in this phase (that's Live Activity/WidgetKit, blocked on an Apple
// Developer Program account, see the Phase 3 scope decision).
if (Platform.OS === 'android') {
  registerSavingsWidgetHandler();
}

// registerRootComponent calls AppRegistry.registerComponent('main', () => App);
// It also ensures that whether you load the app in Expo Go or in a native build,
// the environment is set up appropriately
registerRootComponent(App);
