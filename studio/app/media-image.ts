import Image from '@tiptap/extension-image';
import {displayImage} from './transport';
export default Image.extend({
  addNodeView() {
    return ({node}) => {
      const dom=document.createElement('img');let alive=true;
      dom.alt=node.attrs.alt||'';
      if(node.attrs.title)dom.title=node.attrs.title;
      displayImage(node.attrs.src).then(src=>{if(alive)dom.src=src;}).catch(()=>{dom.alt+=' (Reconnect to load image)';});
      return {dom,destroy(){alive=false;}};
    };
  },
});
