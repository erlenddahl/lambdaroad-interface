import React from 'react';
import Button from 'react-bootstrap/Button';
import PropTypes from 'prop-types';
import ConsoleInformationPanel from './Helpers/ConsoleInformationPanel.js';
import CalcHelper from "./Calculations/CalcHelper.js";
import ReactFrappeChart from "react-frappe-charts";
import { faSpinner } from '@fortawesome/pro-solid-svg-icons'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { Alert, Card } from 'react-bootstrap';
import { API_URL } from './Helpers/Constants.js';
import UserSettings from './Helpers/UserSettings';

class SinglePointCalculator extends React.Component {

    constructor(props) {
        super(props);

        this._helper = new CalcHelper();

        this.state = {
            isBusy: false,
            results: null
        };

        this.apiUrl = API_URL + "/SinglePoint";

        this.onCalculationClicked = this.onCalculationClicked.bind(this);
    }

    async onCalculationClicked(){
        this.setState({ results: null, isBusy: true, calculationError: null });

        try{
            const requestOptions = {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(this._helper.addCalculationParameters({
                        "baseStation": this._helper.toBaseStationObject(this.props.station),
                        "targetCoordinates": this._helper.toUtm(this.props.coordinate)
                    }, UserSettings.getCalculationParameters()))
            };
            const response = await fetch(this.apiUrl, requestOptions);
            const data = await response.json();

            if(data.error) throw data.error;

            data.labels = data.rsrp.map((_, i) => i);
            data.altitudes = data.vector.map(p => p.z);
            data.finalRsrp = data.rsrp[data.rsrp.length - 1];
            
            this.setState({ results: data });

        }catch(ex){
            console.log(ex);
            this.setState({calculationError: ex?.message || ex, results: null});
        }

        this.setState({ isBusy: false });
    }

    exportCsv(){

        let csv = "distance from antenna;terrain height;path loss;rsrp<br />";
        const r = this.state.results;

        for(var i = 0; i < r.distance; i++){
            csv += r.labels[i] + ";" + r.altitudes[i] + ";" + r.loss[i] + ";" + r.rsrp[i] + "<br />";
        }

        this.props.popupRequested({
            contents: csv
        });
    }

    getCurrentCalcId(){
        return this.props.station.id + "_" + this.getCoordinateString(this.props.coordinate);
    }

    getCoordinateString(lngLat, decimals=8){
        return lngLat[0].toFixed(decimals) + ", " + lngLat[1].toFixed(decimals);
    }

    checkCalculation(){
        const id = this.getCurrentCalcId();
        if(!this.state.isBusy && id !== this.calculationId){
            this.calculationId = id;
            this.onCalculationClicked();
        }
    }

    componentDidMount(){
        this.checkCalculation();
    }

    componentDidUpdate() {
        this.checkCalculation();
    }

    _renderChart(r, height){
        return (<ReactFrappeChart
            type="line"
            axisOptions={{ xAxisMode: "tick", yAxisMode: "tick", xIsSeries: true }}
            lineOptions={{ hideDots: 1 }}
            height={height}
            data={{
                labels: r.labels,
                datasets: [{ 
                    name: "RSRP",
                    chartType: "line",
                    values: r.rsrp 
                }, { 
                    name: "Terrain height",
                    chartType: "line",
                    values: r.altitudes 
                }],
            }}
        />);
    }

    render() {
        
        const r = this.state.results || {};

        if(this.state.calculationError){
            return (<div className="calculator-setup" style={this.props.style}>
                <Alert className="mt-4" variant="danger">{this.state.calculationError}</Alert>
                <Button className="lower-right" onClick={this.props.closeRequested}>Close</Button>
            </div>)
        }

        return <div className="calculator-setup" style={this.props.style}>

            <div className="calculator-summary">
                <Card>
                    <Card.Header>From</Card.Header>
                    <Card.Body>
                        <Card.Text>
                            {this.props.station.name} ({this.props.station.id})<br />
                            {this.props.station.getCoordinateString(5)}
                        </Card.Text>
                    </Card.Body>
                </Card>
                
                <Card>
                    <Card.Header>To</Card.Header>
                    <Card.Body>
                        <Card.Text>
                            Coordinate<br />
                            {this.getCoordinateString(this.props.coordinate, 5)}
                        </Card.Text>
                    </Card.Body>
                </Card>
                
                <Card>
                    <Card.Header>Distance</Card.Header>
                    <Card.Body>
                        <Card.Text>
                            {r.distance} m
                        </Card.Text>
                    </Card.Body>
                </Card>
                
                <Card>
                    <Card.Header>Final RSRP</Card.Header>
                    <Card.Body>
                        <Card.Text>
                            {r.finalRsrp?.toFixed(0)} dB
                        </Card.Text>
                    </Card.Body>
                </Card>
            </div>

            {this.state.isBusy && <div><FontAwesomeIcon spin={true} icon={faSpinner}></FontAwesomeIcon> Calculating ...</div>}

            {!this.state.isBusy && r && <div>
                
                {this.state.showDetails && (<div>
                    {this._renderChart(r, 230)}
                    <ConsoleInformationPanel data={r.snapshot}></ConsoleInformationPanel>
                </div>)}
                
                
                {!this.state.showDetails && (<div>
                    {this._renderChart(r, 380)}
                </div>)}

                <Button className="lower-left" variant="secondary" onClick={() => this.setState(s => ({ showDetails: !s.showDetails }))}>Details</Button>
                
                <div className="lower-right">
                    <Button className="mx-2" variant="info" onClick={() => this.exportCsv()}>Export as CSV</Button>
                    <Button onClick={this.props.closeRequested}>Close</Button>
                </div>
            </div>}
        </div>
    }
}

SinglePointCalculator.propTypes = {
    style: PropTypes.object,
    station: PropTypes.object,
    coordinate: PropTypes.array,
    closeRequested: PropTypes.func,
    popupRequested: PropTypes.func
};

export default SinglePointCalculator;