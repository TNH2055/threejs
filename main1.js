import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader';
import { FontLoader } from 'three/examples/jsm/loaders/FontLoader';
import { TextGeometry } from 'three/examples/jsm/geometries/TextGeometry';

let scene, camera, renderer, controls;
let model, layers = {}, cloud;
let directionalLight, temperatureText, font;

export default function init() {
  let scene, camera, renderer, controls, pointLight, model;
  let lastSentTime = 0;
  const receivedData1 = Object.create(null);

  const socket = new WebSocket('wss://inwa-daten.hof-university.de/ws/data');// node-red url of the server it can be global or local
    
  socket.addEventListener('open', (event) => {
      console.log('WebSocket connection established');
  });
  socket.addEventListener('error', (error) => {
      console.error('WebSocket Error:', error);
  });
  socket.addEventListener('close', () => {
      console.log('WebSocket connection closed');
  });

  const socket1 = new WebSocket('wss://inwa-daten.hof-university.de/ws');// node-red url of the server it can be global or local

  socket1.addEventListener('open', (event) => {
      console.log('WebSocket connection established');
  });

  socket1.addEventListener('close', () => {
    console.log('WebSocket connection closed');
  });

  socket1.addEventListener('message', (event) => {
    try {
        const result = JSON.parse(event.data);

        Object.keys(result).forEach(key => {
            receivedData1[key] = result[key];
        });
        if (receivedData1.humidity !== undefined) {
         updateModelSize(receivedData1.humidity / 50); // Adjust scale factor as needed
      }
        console.log('Data received from Node-RED:', receivedData1);
        console.log('Humidity:', receivedData1.humidity);
    } catch (error) {
        console.error('Error parsing data from Node-RED:', error);
    }
  });

  function requestData() {
    if (socket1.readyState === WebSocket.OPEN) {
        socket1.send('getData');
    } else {
        console.log('WebSocket is not open. ReadyState:', socket1.readyState);
    }
  }

  function sendPing() {
    if (socket.readyState === WebSocket.OPEN) {
      socket.send('ping');
    }
  }

  function setupScene() {
    scene = new THREE.Scene();

    
    camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
    camera.position.set(1, 2, 3);

    
    renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setClearColor(0xffffff); 
    renderer.setSize(window.innerWidth, window.innerHeight);
    document.getElementById('container').appendChild(renderer.domElement);

    controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;

    const ambientLight = new THREE.AmbientLight(0xffffff, 1.5);
    scene.add(ambientLight);

    directionalLight = new THREE.DirectionalLight(0xffffff, 1);
    directionalLight.position.set(5, 10, 7.5);
    scene.add(directionalLight);



    let animateRainFlag = false;
    document.getElementById('playButton').addEventListener('click', () => {
        animateRainFlag = !animateRainFlag; 
    });

    let cloudFlag = false;
    document.getElementById('cloudPositionSlider').addEventListener('input', (event) => {
        const sliderValue = event.target.value;
        if (sliderValue == 100){
            cloudFlag=true;
        }
        else{
            cloudFlag=false
        }
    });

    function createRain(cloudPosition,raindropMesh) {
        const rainCount = 1000;
        const rainGeometry = new THREE.BufferGeometry();
        const rainPositions = new Float32Array(rainCount * 3);
        const rainSpeeds = new Float32Array(rainCount);
        const dummy = new THREE.Object3D();
        const initialPositions = [];

        const instancedRain = new THREE.InstancedMesh(
            raindropMesh.geometry,
            raindropMesh.material,  
            rainCount                
          );
        
        for (let i = 0; i < rainCount; i++) {
          const x = cloudPosition.x + (Math.random() * 40 - 20);  
          const y = cloudPosition.y;  
          const z = cloudPosition.z + (Math.random() * 40 - 20);  
          rainSpeeds[i] = Math.random() * 0.1 + 0.05;

          initialPositions.push({ x, y, z });
          dummy.position.set(x, y, z);
          dummy.scale.set(0.1, 0.1, 0.1);
          dummy.updateMatrix();  
          instancedRain.setMatrixAt(i, dummy.matrix);
            
        }
        rainGeometry.setAttribute('position', new THREE.BufferAttribute(rainPositions, 3));
        rainGeometry.setAttribute('speed', new THREE.BufferAttribute(rainSpeeds, 1));
        const rainMaterial = new THREE.PointsMaterial({
          color: 0xaaaaaa, 
          size: 0.2,
          transparent: true,
        });
        const rain = new THREE.Points(rainGeometry, rainMaterial);
        scene.add(instancedRain);
        scene.add(rain);
    
        function updateRain() {
            if (animateRainFlag && cloudFlag) {  
              animateRain(instancedRain, rainSpeeds, cloudPosition.y);
              instancedRain.visible = true; 
            }
            else{
                instancedRain.visible = false;
                for (let i = 0; i < instancedRain.count; i++) {
                    const initialPos = initialPositions[i];
                    dummy.position.set(initialPos.x, initialPos.y, initialPos.z);
                    dummy.updateMatrix();
                    instancedRain.setMatrixAt(i, dummy.matrix);
                  }
                  instancedRain.instanceMatrix.needsUpdate = true;
            }
            requestAnimationFrame(updateRain); 
          }
          updateRain();
      }
      
      function animateRain(instancedRain, rainSpeeds, cloudHeight) {
        const dummy = new THREE.Object3D();  
      
        function update() {
          for (let i = 0; i < instancedRain.count; i++) {
            instancedRain.getMatrixAt(i, dummy.matrix);
            dummy.matrix.decompose(dummy.position, dummy.rotation, dummy.scale);  
            dummy.position.y -= rainSpeeds[i]*5;
            if (dummy.position.y < cloudHeight - 30) {
              dummy.position.y = cloudHeight; 
            }

            dummy.updateMatrix();
            instancedRain.setMatrixAt(i, dummy.matrix);  
          }
      
          instancedRain.instanceMatrix.needsUpdate = true;  
        }
      
        update();
      }

      
    
      
      

    const loader = new GLTFLoader();
    loader.load('/model4.glb', (gltf) => {
        model = gltf.scene;
        scene.add(model);
    
        layers.layer1 = model.getObjectByName('PR_WP');
        layers.layer2 = model.getObjectByName('PR_DL');
        layers.layer3 = model.getObjectByName('PR_HC');
        layers.layer4 = model.getObjectByName('PR_MW');
        layers.layer5 = model.getObjectByName('PR_SOIL');
        layers.layer6 = model.getObjectByName('PR_Veg');
        
        const raindropMesh = gltf.scene.getObjectByName('Rain1'); 
        for(var i=1;i<=10;i++){
            var cloud_name =("Cloud"+i);
            cloud = model.getObjectByName(cloud_name);
            const cloud_rain = gltf.scene.getObjectByName(cloud_name);  
            createRain(cloud_rain.position,raindropMesh);
        }
        

        
    });


    const fontLoader = new FontLoader();
    fontLoader.load('/fonts/helvetiker_regular.typeface.json', (loadedFont) => {
        font = loadedFont;
        createTemperatureText('20°C', new THREE.Color(0.6, 1, 0.6)); 
    });

    window.addEventListener('resize', onWindowResize, false);

    document.getElementById('layerSlider').addEventListener('input', onLayerSliderChange);
    document.getElementById('colorSlider').addEventListener('input', onColorSliderChange);
    document.getElementById('cloudPositionSlider').addEventListener('input', onCloudPositionSliderChange);
  }

  function onWindowResize() {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
  }

  function animate() {
    requestAnimationFrame(animate);
    controls.update();
    renderer.render(scene, camera);
  }

  function onLayerSliderChange(event) {
    const sliderValue = event.target.value;
    const normalizedValue = sliderValue / 100;

    const initialYPositions = {
        layer1: 10.0175,
        layer2: 10.1765,
        layer3: 10.4624,
        layer4: 10.7754,
        layer5: 11.0715,
        layer6: 11.5488,
    };
    const roofY = 3.2989;

    Object.entries(layers).forEach(([layerName, layer]) => {
        if (layer) {
            layer.position.y = initialYPositions[layerName] + (roofY - initialYPositions[layerName]) * normalizedValue;
        }
    });
  }

  function onColorSliderChange(event) {
      const sliderValue = event.target.value;
      const normalizedValue = sliderValue / 100;

      const targetColor = new THREE.Color(0.42, 0.42, 0.42);

      ['layer6', 'layer5'].forEach(layerName => {
          const layer = layers[layerName];
          if (layer) {
              layer.traverse((child) => {
                  if (child.isMesh) {
                      child.material.color.r = 1 - (1 - targetColor.r) * normalizedValue;
                      child.material.color.g = 1 - (1 - targetColor.g) * normalizedValue;
                      child.material.color.b = 1 - (1 - targetColor.b) * normalizedValue;
                  }
              });
          }
      });

      directionalLight.intensity = 1 + 2 * normalizedValue;

      if (temperatureText && font) {
          const newTemperature = 20 + 20 * normalizedValue;
          const newText = `${newTemperature.toFixed(1)}°C`;

          const textColor = new THREE.Color().lerpColors(
              new THREE.Color(0.6, 1, 0.6), 
              new THREE.Color(1, 0.6, 0.6), 
              normalizedValue
          );

          scene.remove(temperatureText);
          createTemperatureText(newText, textColor);
      }
  }
  
  function onCloudPositionSliderChange(event) {
    const sliderValue = event.target.value;
    const normalizedValue = sliderValue / 100;
  
    
    const skyBlue = { r: 135 / 255, g: 206 / 255, b: 235 / 255 };
    const gray = { r: 128 / 255, g: 128 / 255, b: 128 / 255 };
  
   
    const r = skyBlue.r + (gray.r - skyBlue.r) * normalizedValue;
    const g = skyBlue.g + (gray.g - skyBlue.g) * normalizedValue;
    const b = skyBlue.b + (gray.b - skyBlue.b) * normalizedValue;
  
    
    scene.background = new THREE.Color(r, g, b);
  
   
    for (let i = 1; i <= 10; i++) {
      const cloud_name = "Cloud" + i;
      const cloud = model.getObjectByName(cloud_name);
      if (cloud) {
        cloud.traverse((child) => {
          if (child.isMesh) {
            child.material = new THREE.MeshBasicMaterial({ color: 0x2a2a2a });
            child.material.opacity = normalizedValue;
            child.material.reflection=1;
            child.material.transparent = true;
          }
        });
      }
    }
  }
  

  function createTemperatureText(text, color) {
      if (font) {
          const textGeometry = new TextGeometry(text, {
              font: font,
              size: 0.5,
              height: 0.1,
          });

          const textMaterial = new THREE.MeshBasicMaterial({ color: color });
          temperatureText = new THREE.Mesh(textGeometry, textMaterial);

          temperatureText.position.set(-7, 13, -28);
          temperatureText.rotation.set(0, -80, 0);
          scene.add(temperatureText);
      }
  }

  function sendSliderData(value) {
      if (socket.readyState === WebSocket.OPEN) {
          console.log(`Sending value via WebSocket: ${value}`);
          socket.send(JSON.stringify(value));
      } else {
          console.warn('WebSocket is not open. Ready state:', socket.readyState);
      }
  }

  function debounce(fn, delay) {
      let timeout;
      return function(...args) {
          clearTimeout(timeout);
          timeout = setTimeout(() => fn(...args), delay);
      };
  }

  function setupSlider(slide_no) {
      const sl_no={}
      const slider = document.getElementById(slide_no);
      if (slider) {
          slider.addEventListener('input', debounce((event) => {
              const sliderValue = Number(event.target.value);
              sl_no[slide_no]=sliderValue;
              sendSliderData(sl_no);
          }, 200));
      } else {
          console.error('Slider element not found');
      }
  }
  
  function initialize() {
      setupSlider("cloudPositionSlider");
      setupSlider("colorSlider");
      setupSlider("layerSlider");
      setupSlider("tankSlider");
      setupSlider("pipeSlider");
      setupSlider("motorSlider");
      setupSlider("valveSlider");
      setupSlider("timeSlider");
      setupSlider("sunSlider");
      console.log('WebSocket Client Initialized');
      window.addEventListener('beforeunload', sendPing);
  }
  
  requestData();
  initialize();
  setupScene();
  animate();
}

init();