import React from 'react';
import { BHintIcon } from './bhinticon';
import css from './bbuttons.css';

interface InnerWrapper {
  onHintValue(nr: number): any;
  onHintColor(nr: number): any;

  myTurn: boolean;
  keyPropagation: string;
}

const Values = [1, 2, 3, 4, 5];

export class BButtons extends React.Component<InnerWrapper, {}> {
  render() {
    if (!this.props.myTurn) {
      return null;
    }
    return (
      <div className={css.wrapper}>
        {this.renderValues()}
        {this.renderColors()}
      </div>
    );
  }

  renderValues() {
    return Values.map((value: number) => (
      <button
        key={`Value${value}`}
        onClick={() => {
          this.props.onHintValue(value);
        }}
        className={css.button}
      >
        <BHintIcon
          hintIcon={{ color: -1, value }}
          keyPropagation={this.props.keyPropagation + 'BButtonValue' + value.toString()}
        ></BHintIcon>
      </button>
    ));
  }

  renderColors() {
    return Values.map((value: number) => (
      <button
        key={`Color${value}`}
        onClick={() => {
          this.props.onHintColor(value);
        }}
        className={css.button}
      >
        <BHintIcon
          hintIcon={{ color: value, value: -1 }}
          keyPropagation={this.props.keyPropagation + 'BButtonColor' + value.toString()}
        ></BHintIcon>
      </button>
    ));
  }
}
