import React from 'react';

import {utilityStore} from './store';

import {Btn, Col} from './bootstrap';

import changelog from 'html!markdown!../../../changelog.md';

var About = React.createClass({
  render: function() {
    function createMarkup() { return {__html: changelog};}
    return (
      <Col size="12" className="about">
        <Btn onClick={()=>utilityStore.createTab('https://github.com/jaszhix/tab-master-5000-chrome-extension')} className="ntg-setting-btn" fa="github-square">Github</Btn>
        <Btn onClick={()=>utilityStore.createTab('https://chrome.google.com/webstore/detail/tab-master-5000-tab-swiss/mippmhcfjhliihkkdobllhpdnmmciaim')} className="ntg-setting-btn" style={{marginLeft: '87px'}} fa="chrome">Chrome Web Store</Btn>
        <img src="../../images/icon-128.png" className="ntg-about"/>
        <div className="ntg-about">
          <h3 className="ntg-about">Tab Master 5000</h3>
        </div>
        <Col size="2" />
        <Col size="8" className="ntg-release">
          <div dangerouslySetInnerHTML={createMarkup()} />
        </Col>
        <Col size="2" className="ntg-cc"/>
        <a rel="license" href="http://creativecommons.org/licenses/by/4.0/"><img alt="Creative Commons License" style={{borderWidth:0}} src="https://i.creativecommons.org/l/by/4.0/88x31.png" className="ntg-cc" /></a>
      </Col>
    );
  }
});

export default About;