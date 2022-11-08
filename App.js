/* eslint-disable prettier/prettier */
/* eslint-disable react-native/no-inline-styles */
/**
 * Sample React Native App
 * https://github.com/facebook/react-native
 *
 * @format
 * @flow strict-local
 */

import React, {useState, useEffect} from 'react';
import {
  TouchableHighlight,
  NativeEventEmitter,
  NativeModules,
  Text,
  View,
  PermissionsAndroid,
  Alert, TouchableOpacity, FlatList,
} from "react-native";
import BleManager from 'react-native-ble-manager';

//this is for managing the bluethoot state:
import BluetoothStateManager from 'react-native-bluetooth-state-manager';
import { NordicDFU } from "react-native-nordic-dfu";
import RNFetchBlob from "rn-fetch-blob";

//calls the native module of the ble
const BleManagerModule = NativeModules.BleManager;
const bleManagerEmitter = new NativeEventEmitter(BleManagerModule);

const App = () => {
  const [isScanning, setIsScanning] = useState(false);
  const peripherals = new Map();
  const [list, setList] = useState([]);
  const [isConnected, setIsConnected] = useState(false);
  const [renderList, setRenderList] = useState(false);
  const [showDeviceNotFound, setDeviceNotFound] = useState(false);


  //check if the bluethoot is enable on the device
  async function getState() {
    try {
      const response = await BluetoothStateManager.getState();
      switch (response) {
        case 'Unknown':
          console.log('unknown');
          break;
        case 'Resetting':
          console.log('resetting');
          break;
        case 'Unsupported':
          console.log('unsported');
          break;
        case 'Unauthorized':
          console.log('unhauthorized');
          break;
        case 'PoweredOff':
          console.log('off');
          BluetoothStateManager.requestToEnable().then(result => {
            if (!result) {
              Alert('you must active the bluethoot');
            }
            // result === true -> user accepted to enable bluetooth
            // result === false -> user denied to enable bluetooth
          });
          break;
        case 'PoweredOn':
          console.log('on');
          break;
        default:
          break;
      }
    } catch (e) {
      console.log(e, 'Lol');
    }
  }

  useEffect(() => {
    BleManager.start({showAlert: false});

    //active the bluethoot if its off
    getState();

    PermissionsAndroid.check(
        PermissionsAndroid.PERMISSIONS.ACCESS_COARSE_LOCATION,
        PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION,
        PermissionsAndroid.PERMISSIONS.FOREGROUND_SERVICE,
        PermissionsAndroid.PERMISSIONS.BLUETOOTH_ADVERTISE,
        PermissionsAndroid.PERMISSIONS.WRITE_EXTERNAL_STORAGE,
    ).then(granted => {
      if (granted) {
      } else {
        console.log('Check permissions');

        PermissionsAndroid.requestMultiple([
          PermissionsAndroid.PERMISSIONS.ACCESS_COARSE_LOCATION,
          PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION,
          PermissionsAndroid.PERMISSIONS.FOREGROUND_SERVICE,
          PermissionsAndroid.PERMISSIONS.BLUETOOTH_ADVERTISE,
          PermissionsAndroid.PERMISSIONS.WRITE_EXTERNAL_STORAGE,
          ]).then(granted2 => {
            console.log(granted2)
        })
      }
    });

    /*Add all the listener to the module  */
    bleManagerEmitter.addListener(
        'BleManagerDiscoverPeripheral',
        handleDiscoverPeripheral,
    );
    bleManagerEmitter.addListener('BleManagerStopScan', handleStopScan);
    bleManagerEmitter.addListener(
        'BleManagerDisconnectPeripheral',
        handleDisconnectedPeripheral,
    );

    return () => {
      console.log('unmount');
      bleManagerEmitter.removeListener(
          'BleManagerDiscoverPeripheral',
          handleDiscoverPeripheral,
      );
      bleManagerEmitter.removeListener('BleManagerStopScan', handleStopScan);
      bleManagerEmitter.removeListener(
          'BleManagerDisconnectPeripheral',
          handleDisconnectedPeripheral,
      );

    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /* end useEffect and bluethoot is ready */

  /* functions of the Native Module to discover and disconnect peripherals   */

  // The scanning find a new peripheral.
  const handleDiscoverPeripheral = peripheral => {
    console.log('Got ble peripheral', peripheral);
    if (!peripheral.name) {
      peripheral.name = 'NO NAME';
    }
    peripherals.set(peripheral.id, peripheral);
    setList(Array.from(peripherals.values()));
  };

  //this is called when the device is disconnected
  const handleDisconnectedPeripheral = data => {
    //here I want to put the alert when the device is not reachable
    if (!isConnected && !isScanning) {
      console.log('Ok');
      setDeviceNotFound(true);
    }
    let peripheral = peripherals.get(data.peripheral);
    // removeData();
    if (peripheral) {
      peripheral.connected = false;
      peripherals.set(peripheral.id, peripheral);
      setList(Array.from(peripherals.values()));
    }
    console.log('Disconnected from ' + data.peripheral);
    setIsConnected(false);
  };

  // if the device exist dont scan anything go directly to connect this device
  const startScan = () => {
    if (!isScanning) {
      BleManager.scan([], 3, true)
          .then(results => {
            console.log('Scanning...');
            setIsScanning(true);
            setRenderList(true);
          })
          .catch(err => {
            console.error(err);
          });
    }
  };

  // this is called when the scan is finished
  const handleStopScan = () => {
    console.log('Scan is stopped');
    setIsScanning(false);
  };


  function upgradeFirmware(item) {
    console.log('Downloading firmware...')
    this.setState({ upgrading: true })
    RNFetchBlob
      .config({
        fileCache: true,
        appendExt: 'zip'
      })
      .fetch('GET', 'https://tmpfiles.org/dl/221689/tll-v1.0.4.zip', {
        // Authorization : 'Bearer access-token...',
        // more headers  ..
      })
      .then((res) => {
        let status = res.info().status
        console.log('Status download firmware:' + status)
        if (status === 200) {
          console.log('file:///' + res.path())
          NordicDFU.startDFU({
            deviceAddress: item.id,
            deviceName: "Pilloxa Pillbox",
            filePath: res.path(),
          })
            .then((res) => console.log("Transfer done:", res))
            .catch(console.log);
        }
      })

  }

  const renderItem = item => {
    const color = item.connected ? 'green' : '#fff';
    return (
        //try to correct this function, maybe we can only pass here connect and eliminate this.
        <TouchableHighlight onPress={() => upgradeFirmware(item)}>
          <View style={{backgroundColor: color, marginTop: 10}}>
            <Text
                style={{
                  fontSize: 12,
                  textAlign: 'center',
                  color: '#333333',
                  padding: 10,
                }}>
              {item.name}
            </Text>
            <Text
                style={{
                  fontSize: 10,
                  textAlign: 'center',
                  color: '#333333',
                  padding: 2,
                }}>
              RSSI: {item.rssi}
            </Text>
            <Text
                style={{
                  fontSize: 8,
                  textAlign: 'center',
                  color: '#333333',
                  padding: 2,
                  paddingBottom: 20,
                }}>
              {item.id}
            </Text>
          </View>
        </TouchableHighlight>
    );
  };

  return (
      <>
        {isScanning || !isConnected ? (
          <>
            {isScanning && <Text>Scanning...</Text>}
            <TouchableOpacity onPress={startScan}><Text>Scan</Text></TouchableOpacity>

            <FlatList
              data={list}
              renderItem={({item}) => renderItem(item)}
              keyExtractor={item => item.id}
            />
          </>

        ) : null}
      </>
  );
};

export default App;
