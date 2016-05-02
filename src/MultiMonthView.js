import React, { PropTypes } from 'react'
import { findDOMNode } from 'react-dom'
import Component from 'react-class'

import { Flex } from 'react-flex'
import InlineBlock from 'react-inline-block'

import moment from 'moment'
import assign from 'object-assign'

import NavBar from './NavBar'
import toMoment from './toMoment'
import join from './join'
import isInRange from './utils/isInRange'

import bemFactory from './bemFactory'

import { getDaysInMonthView } from './BasicMonthView'
import MonthView from './MonthView'
import NavigationView from './NavigationView'

const emptyFn = () => {}

const times = (count) => [...new Array(count)].map((v, i) => i)

export default class MultiMonthView extends Component {

  constructor(props){
    super(props)

    this.state = {
      date: props.defaultDate,
      activeDate: props.defaultActiveDate,
      viewDate: props.defaultViewDate
    }
  }

  componentWillMount(){
    this.updateToMoment(this.props)
  }

  componentWillReceiveProps(nextProps){
    if (nextProps.locale != this.props.locale || nextProps.dateFormat != this.props.dateFormat){
      this.updateToMoment(nextProps)
    }
  }

  updateToMoment(props){

    this.toMoment = (value, dateFormat) => {
      return toMoment(value, {
        locale: props.locale,
        dateFormat: dateFormat || props.dateFormat
      })
    }
  }

  prepareViewDate(props){
    return props.viewDate === undefined?
            this.state.viewDate:
            props.viewDate
  }

  prepareDate(props){

    if (props.range){
      return null
    }

    return props.date === undefined?
            this.state.date:
            props.date
  }

  prepareActiveDate(props){
    const activeDate = props.activeDate === undefined?
            //only fallback to date if activeDate not specified
            this.state.activeDate || this.prepareDate(props):
            props.activeDate

    if (activeDate && props.inViewStart && props.inViewEnd && props.constrainActiveInView){
      const activeMoment = this.toMoment(activeDate)

      if (!isInRange(activeMoment, [props.inViewStart, props.inViewEnd])){
        const date = this.prepareDate(props)
        const dateMoment = this.toMoment(date)

        if (date && isInRange(dateMoment, [props.inViewStart, props.inViewEnd])){
          return date
        }

        return null
      }
    }

    return activeDate
  }

  prepareViews(props){
    const daysInView = []

    const viewMoments = []

    const viewMoment = props.viewMoment

    let index = 0
    const size = props.size

    while (index < size){
      const mom = this.toMoment(viewMoment).add(index, 'month')
      const days = getDaysInMonthView(mom, props)

      viewMoments.push(mom)
      daysInView.push(days)

      index++
    }

    props.daysInView = daysInView
    props.viewMoments = viewMoments

    const lastViewDays = daysInView[size - 1]

    props.inViewStart = daysInView[0][0]
    props.inViewEnd = lastViewDays[lastViewDays.length - 1]
  }

  prepareProps(thisProps){
    const props = assign({}, thisProps)

    props.viewMoment = this.toMoment(this.prepareViewDate(props))

    //viewStart is the first day of the first month displayed
    //viewEnd is the last day of the last month displayed
    props.viewStart = this.toMoment(props.viewMoment).startOf('month')
    props.viewEnd = this.toMoment(props.viewStart).add(props.size - 1, 'month').endOf('month')

    //but we also have inViewStart, which can be a day before viewStart
    //which is in displayed as belonging to the prev month
    //but is displayed in the current view since it's on the same week
    //as viewStart
    //
    //same for inViewEnd, which is a day after viewEnd - the last day in the same week
    this.prepareViews(props)

    const activeDate = this.prepareActiveDate(props)

    if (activeDate){
      props.activeDate = +this.toMoment(activeDate)
    }

    props.date = this.prepareDate(props)

    return props
  }

  render(){

    const props = this.p = this.prepareProps(this.props)
    const size = props.size

    const rowCount = Math.ceil(size/props.perRow)
    const children = times(rowCount).map(this.renderRow).filter(x => !!x)

    return <Flex
      column
      alignItems="stretch"
      {...props}
      children={children}
    />
  }

  renderRow(rowIndex){
    const props = this.p

    const children = times(props.perRow).map(i => {
      const index = (rowIndex * props.perRow) + i

      if (index >= props.size){
        return null
      }

      return this.renderView(index, props.size)
    })

    return <Flex row wrap={false} children={children} />
  }

  renderView(index, size){

    const props = this.p
    const viewMoment = props.viewMoments[index]
    // let activeDate = props.activeDate && this.toMoment(props.activeDate)

    // if (activeDate){

    //   const viewMomentStart = this.toMoment(viewMoment).startOf('month')
    //   const viewMomentEnd = this.toMoment(viewMoment).endOf('month')

    //   const range = [viewMomentStart, viewMomentEnd]

    //   if (!isInRange(activeDate, { range, inclusive: true })){
    //     activeDate = null
    //   }
    // }

    return <MonthView
      {...this.props}

      index={index}

      constrainActiveInView={false}

      navigate={this.onMonthNavigate.bind(this, index)}

      activeDate={props.activeDate}

      onActiveDateChange={this.onActiveDateChange}
      onViewDateChange={this.onAdjustViewDateChange}

      date={props.date}
      onChange={this.onChange}

      viewMoment={viewMoment}

      daysInView={props.daysInView[index]}

      showDaysBeforeMonth={index == 0}
      showDaysAfterMonth={index == size - 1}

      confirm={this.confirm}

      renderNavBar={this.renderNavBar.bind(this, index, viewMoment)}
    />
  }

  confirm(date, event){
    const props = this.p

    if (props.confirm){
      return props.confirm(date, event)
    }

    const dateMoment = date && this.toMoment(date)

    if (dateMoment){
      const range = [props.inViewStart, props.inViewEnd]

      if (!isInRange(dateMoment, {range, inclusive: true})){
        return
      }
    }

    if (dateMoment){
      const timestamp = +dateMoment

      this.onAdjustViewDateChange({ dateMoment, timestamp })
      this.onActiveDateChange({ dateMoment, timestamp})
      this.onChange({ dateMoment, timestamp }, event)
    }
  }

  renderNavBar(index, viewMoment){

    const navBarProps = {
      secondary: true,
      renderNavNext: this.renderHiddenNav,
      renderNavPrev: this.renderHiddenNav,

      viewMoment,

      onViewDateChange: this.onViewDateChange,
      onUpdate: this.updateViewMoment
    }

    if (index == 0){
      delete navBarProps.renderNavPrev
    }

    if (index == this.props.perRow - 1){
      delete navBarProps.renderNavNext
    }

    return <NavBar {...navBarProps} />
  }

  onMonthNavigate(index, dir, event){
    const props = this.p

    event.preventDefault()

    if (!props.activeDate){
      return
    }

    const nextMoment = this.toMoment(this.p.activeDate).add(dir, 'day')
    const viewMoment = this.toMoment(nextMoment)

    this.onActiveDateChange({
      dateMoment: nextMoment,
      timestamp: +nextMoment
    })

    if (this.isInRange(viewMoment)){
      return
    }

    if (viewMoment.isAfter(props.viewEnd)){
      viewMoment.add(-props.size + 1, 'month')
    }

    this.onViewDateChange({
      dateMoment: viewMoment,
      timestamp: +viewMoment
    })
  }

  onAdjustViewDateChange({ dateMoment, timestamp }){
    const props = this.p

    let update = false

    if (dateMoment.isAfter(props.viewEnd)){
      dateMoment = this.toMoment(dateMoment).add(-props.size + 1, 'month')
      timestamp = +dateMoment
      update = true
    } else if (dateMoment.isBefore(props.viewStart)){
      update = true
    }

    update && this.onViewDateChange({ dateMoment, timestamp })
  }

  updateViewMoment(dateMoment, dir){
    const sign = dir < 0? -1: 1
    const abs = Math.abs(dir)

    const newMoment = this.toMoment(this.p.viewStart)

    newMoment.add(sign, abs == 1? 'month': 'year')

    return newMoment
  }

  renderHiddenNav(props){
    return <InlineBlock {...props} style={{visibility: 'hidden'}} />
  }

  isInRange(moment){
    return isInRange(moment, [this.p.viewStart, this.p.viewEnd])
  }

  onViewDateChange({ dateMoment, timestamp }){

    if (this.props.viewDate === undefined ){
      this.setState({
        viewDate: timestamp
      })
    }

    this.props.onViewDateChange({ dateMoment, timestamp})
  }

  onActiveDateChange({ dateMoment, timestamp }){

    if (this.props.activeDate === undefined ){
      this.setState({
        activeDate: timestamp
      })
    }

    this.props.onActiveDateChange({ dateMoment, timestamp})
  }

  gotoViewDate({ dateMoment, timestamp }){

    if (!timestamp){
      timestamp = +dateMoment
    }

    this.onViewDateChange({ dateMoment, timestamp })
    this.onActiveDateChange({ dateMoment, timestamp })

  }

  goto({ dateMoment, timestamp }){
    this.gotoViewDate({ dateMoment, timestamp })
    this.onChange({ dateMoment, timestamp })
  }

  onChange({ dateMoment, timestamp }, event){
    if (this.props.date === undefined){
      this.setState({
        date: timestamp
      })
    }

    if (this.props.onChange){
      this.props.onChange({ dateMoment, timestamp }, event)
    }
  }
}

MultiMonthView.defaultProps = {
  perRow: 2,
  size: 4,

  constrainActiveInView: true,

  dateFormat: 'YYYY-MM-DD',
  onActiveDateChange: () => {},
  onViewDateChange: () => {}
}

MultiMonthView.propTypes = {
}
