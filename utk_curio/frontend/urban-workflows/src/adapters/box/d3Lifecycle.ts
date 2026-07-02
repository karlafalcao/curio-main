import React, { useEffect } from 'react';
import { BoxLifecycleHook } from '../../registry/types';
import { getGrammarAdapter } from '../../registry/grammarAdapter';


const D3_OUTPUT_ID_PREFIX = 'd3';

function getDefaultSpecString(): string {
  const adapter = getGrammarAdapter('d3');
  const spec = adapter.getDefaultSpec?.();
  return typeof spec === 'string' ? spec : JSON.stringify(spec ?? { mark: 'bar' });
}

export const useD3Lifecycle: BoxLifecycleHook = (data, boxState) => {

  // const contentComponent = React.createElement('div', {
  //   id: 'd3-' + data.nodeId,
  //   className: 'nowheel nodrag',
  //   style: { width: '100%', height: '100%', overflow: 'auto' },
  // });

  const applyGrammar = async (spec: string) => {
    try {
      const adapter = getGrammarAdapter('d3');
      const container = document.getElementById(D3_OUTPUT_ID_PREFIX + data.nodeId);
      if (!container) throw new Error('D3 container not found');

      const specToUse = (spec?.trim() && spec !== '{}') ? spec : getDefaultSpecString();
      await adapter.render(container, specToUse, data.input);
      // boxState.setOutput({ code: 'success', content: '', outputType: '' });
      data.outputCallback(data.nodeId, data.input);
    } catch (error: any) {
      boxState.setOutput({
        code: 'error',
        content: error?.message ?? String(error),
        outputType: '',
      });
      alert(error?.message ?? String(error));
    }
  };

  useEffect(() => {
    console.log('DATA.INPUT CHANGED')
    boxState.setOutput({ code: 'exec', content: ''});
    if (!data.input) return;
    const renderChart = async () => {
      const defaultValueOverride =
        boxState.templateData.code != null
          ? boxState.templateData.code
          : data.defaultCode ?? getDefaultSpecString();

      applyGrammar(defaultValueOverride);
    };
    renderChart();
  }, [data.input]);

  const defaultValueOverride =
    boxState.templateData.code != null
      ? boxState.templateData.code
      : data.defaultCode ?? getDefaultSpecString();

  return { applyGrammar, defaultValueOverride };
};
