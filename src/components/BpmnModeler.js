import React, { useEffect, useRef } from 'react';
import BpmnJS from 'bpmn-js/lib/Modeler';
import 'bpmn-js/dist/assets/diagram-js.css';
import 'bpmn-js/dist/assets/bpmn-font/css/bpmn.css';
import 'bpmn-js-properties-panel/dist/assets/properties-panel.css';

const LOCAL_STORAGE_KEY = 'bpmn-diagram';
const initialDiagram = `<?xml version="1.0" encoding="UTF-8"?>\n<bpmn:definitions xmlns:bpmn="http://www.omg.org/spec/BPMN/20100524/MODEL" xmlns:bpmndi="http://www.omg.org/spec/BPMN/20100524/DI" xmlns:dc="http://www.omg.org/spec/DD/20100524/DC" xmlns:di="http://www.omg.org/spec/DD/20100524/DI" id="Definitions_1" targetNamespace="http://bpmn.io/schema/bpmn">\n  <bpmn:process id="Process_1" isExecutable="false">\n    <bpmn:startEvent id="StartEvent_1" />\n  </bpmn:process>\n  <bpmndi:BPMNDiagram id="BPMNDiagram_1">\n    <bpmndi:BPMNPlane id="BPMNPlane_1" bpmnElement="Process_1">\n      <bpmndi:BPMNShape id="_BPMNShape_StartEvent_2" bpmnElement="StartEvent_1">\n        <dc:Bounds x="173" y="102" width="36" height="36" />\n      </bpmndi:BPMNShape>\n    </bpmndi:BPMNPlane>\n  </bpmndi:BPMNDiagram>\n</bpmn:definitions>`;

const BpmnModeler = () => {
  const containerRef = useRef(null);
  const modelerRef = useRef(null);

  useEffect(() => {
    const modeler = new BpmnJS({
      container: containerRef.current,
    });
    modelerRef.current = modeler;

    const savedDiagram = localStorage.getItem(LOCAL_STORAGE_KEY) || initialDiagram;
    modeler.importXML(savedDiagram)
      .then(() => {
        modeler.get('canvas').zoom('fit-viewport');
      })
      .catch(err => {
        console.error('Error importing BPMN diagram', err);
      });

    const eventBus = modeler.get('eventBus');
    eventBus.on(['element.changed', 'shape.added', 'shape.removed', 'connection.added', 'connection.removed'], () => {
      modeler.saveXML({ format: true }).then(({ xml }) => {
        localStorage.setItem(LOCAL_STORAGE_KEY, xml);
      });
    });

    return () => {
      modeler.destroy();
    };
  }, []);

  const handleSave = () => {
    if (!modelerRef.current) return;
    modelerRef.current.saveXML({ format: true })
      .then(({ xml }) => {
        const encodedData = encodeURIComponent(xml);
        const link = document.createElement('a');
        link.href = 'data:application/bpmn+xml;charset=UTF-8,' + encodedData;
        link.download = 'diagram.bpmn';
        link.click();
      })
      .catch(err => {
        console.error('Error saving BPMN XML:', err);
      });
  };

  const handleExportSVG = () => {
    if (!modelerRef.current) return;
    modelerRef.current.saveSVG()
      .then(({ svg }) => {
        const blob = new Blob([svg], { type: 'image/svg+xml' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = 'diagram.svg';
        link.click();
        URL.revokeObjectURL(url);
      })
      .catch(err => {
        console.error('Error exporting SVG:', err);
      });
  };

  const handleImport = (event) => {
    const file = event.target.files[0];
    if (!file || !modelerRef.current) return;
    const reader = new FileReader();
    reader.onload = (e) => {
      const xml = e.target.result;
      modelerRef.current.importXML(xml)
        .then(() => {
          modelerRef.current.get('canvas').zoom('fit-viewport');
          localStorage.setItem(LOCAL_STORAGE_KEY, xml);
        })
        .catch(err => {
          alert('Could not import the BPMN file. It might be invalid.');
        });
    };
    reader.readAsText(file);
    event.target.value = null;
  };

  const handleNew = () => {
    if (!modelerRef.current) return;
    modelerRef.current.importXML(initialDiagram)
      .then(() => {
        modelerRef.current.get('canvas').zoom('fit-viewport');
      })
      .catch(err => {
        console.error('Error creating new BPMN diagram', err);
      });
  };

  return (
    <div className="modeler-wrapper">
      <div className="button-container" style={{ margin: '10px', textAlign: 'left' }}>
        <button onClick={handleNew} style={{ padding: '8px 15px', marginRight: '10px' }}>
          New
        </button>
        <button onClick={handleSave} style={{ padding: '8px 15px', marginRight: '10px' }}>
          Export
        </button>
        <button onClick={handleExportSVG} style={{ padding: '8px 15px', marginRight: '10px' }}>
          Export SVG
        </button>
        <label className="import-button" style={{ padding: '8px 15px', background: '#34a853', color: 'white', borderRadius: '4px', cursor: 'pointer' }}>
          Import
          <input type="file" accept=".bpmn,.xml" onChange={handleImport} style={{ display: 'none' }} />
        </label>
      </div>
      <div className="modeler-container">
        <div ref={containerRef} style={{ width: '100%', height: '80vh' }}></div>
      </div>
    </div>
  );
};

export default BpmnModeler;
