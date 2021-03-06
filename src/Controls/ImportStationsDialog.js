import React from 'react';
import Button from 'react-bootstrap/Button';
import FormControl from 'react-bootstrap/FormControl';
import FormCheck from 'react-bootstrap/FormCheck';
import FormGroup from 'react-bootstrap/FormGroup';
import FormLabel from 'react-bootstrap/FormLabel';
import Alert from 'react-bootstrap/Alert'
import PropTypes from 'prop-types';
import { Formik, Form, Field, ErrorMessage } from 'formik';
import * as yup from 'yup';
import Papa from 'papaparse';

class ImportStationsDialog extends React.Component {

    constructor(props) {
        super(props);

        this.onSave = this.onSave.bind(this);

        this.validation = yup.object().shape({
            delimiter: yup.string().required(),
            decimalSign: yup.string().required(),
            hasHeaders: yup.bool(),
            csv: yup.string().required()
        });

        this.state = {
            defaultValues: {
                delimiter: ";",
                decimalSign: ".",
                hasHeaders: true,
                csv: "id;name;antennaType;power;gain;height;maxRadius;lng;lat\n" + 
                     "1254;Stasjon 1;MobileNetwork;46;125:140:5|90:125:25|65:90:15|40:65:4;12;10000;10.355430273040675;63.42050427064208\n" +
                     "1255;Alfabra;MobileNetwork;49;-40:-30:8|-30:30:22|30:40:8;4;10000;10.355430273040675;63.41050427064208"
            }
        }
    }

    onSave(values, { setSubmitting }) {
        const stations = this.attemptCsvParse(values, setSubmitting);

        if(!stations) return;

        this.props.onSave(stations);
    }

    parseNumberWithSign(v, decimalSign, error){
        if(v == null) throw error;
        let value = null;
        if(decimalSign == ".")
            value = Number(v.replaceAll(",", ""));
        else
            value = Number(v.replaceAll(".", "").replaceAll(",", "."));

        if(isNaN(value)) throw error;

        return value;
    }

    attemptCsvParse(values, setSubmitting){
        try{
            const csv = Papa.parse(values.csv, {
                delimiter: values.delimiter,
                header: values.hasHeaders
            });

            const stations = csv.data.map((p, i) => ({
                id: p.id,
                name: p.name,
                transmitPower: this.parseNumberWithSign(p.power, values.decimalSign, "Invalid power (" + p.power + ") at line " + i),
                gainDefinition: p.gain,
                antennaType: p.antennaType,
                height: this.parseNumberWithSign(p.height, values.decimalSign, "Invalid height (" + p.height + ") at line " + i),
                maxRadius: this.parseNumberWithSign(p.maxRadius, values.decimalSign, "Invalid max radius (" + p.maxRadius + ") at line " + i),
                lngLat: [this.parseNumberWithSign(p.lng, values.decimalSign, "Invalid lng (" + p.lng + ") at line " + i), this.parseNumberWithSign(p.lat, values.decimalSign, "Invalid lat (" + p.lat + ") at line " + i)]
            }));

            const headerOffset = values.hasHeaders ? 1 : 0;
            stations.map((p, i) => {
                if(!p.id && p.id != 0) throw "Empty id at line " + (i + headerOffset);
                if(!p.name) throw "Empty name at line " + (i + headerOffset);
                if(!p.gainDefinition) throw "Empty gain at line " + (i + headerOffset);
                if(p.antennaType.toLowerCase() != "mobilenetwork" && p.antennaType.toLowerCase() != "itsg5") throw "Invalid antenna type (" + p.antennaType + ") at line " + (i + headerOffset);
                if(isNaN(p.transmitPower)) throw "Invalid power (" + p.transmitPower + ") at line " + (i + headerOffset);
                if(isNaN(p.height)) throw "Invalid height (" + p.height + ") at line " + (i + headerOffset);
                if(isNaN(p.maxRadius)) throw "Invalid max radius (" + p.maxRadius + ") at line " + (i + headerOffset);
                if(isNaN(p.lngLat[0])) throw "Invalid lng (" + p.lngLat[0] + ") at line " + (i + headerOffset);
                if(isNaN(p.lngLat[1])) throw "Invalid lat (" + p.lngLat[1] + ") at line " + (i + headerOffset);
                if(p.lngLat[0] < 0 || p.lngLat[0] > 180) throw "Longitude (" + p.lngLat[0] + ") out of bounds at line " + (i + headerOffset);
                if(p.lngLat[1] < 0 || p.lngLat[1] > 180) throw "Latitude (" + p.lngLat[1] + ") out of bounds at line " + (i + headerOffset);
            });

            this.setState({
                parseError: null
            });
            
            setSubmitting(false);
            return stations;
        }catch(err){
            this.setState({
                parseError: JSON.stringify(err)
            });
        }

        setSubmitting(false);
        return null;
    }

    render() {
        return <div className="station-importer sidebar-block">

            <Formik
                initialValues={this.state.defaultValues}
                validationSchema={this.validation}
                onSubmit={this.onSave} 
                validateOnChange={true}
            >
                {({ isSubmitting, handleSubmit }) => (
                    <Form onSubmit={handleSubmit}>
                        <Field name="delimiter">
                            {({ field }) => (
                                <FormGroup controlId={field.name}>
                                    <FormLabel>Delimiter:</FormLabel>
                                    <FormControl type="text" {...field} />
                                    <ErrorMessage className="error-message" name={field.name} component="div" />
                                </FormGroup>
                            )}
                        </Field>
                        <Field name="decimalSign">
                            {({ field }) => (
                                <FormGroup controlId={field.name}>
                                    <FormLabel>Decimal sign:</FormLabel>
                                    <FormControl type="text" {...field} />
                                    <ErrorMessage className="error-message" name={field.name} component="div" />
                                </FormGroup>
                            )}
                        </Field>
                        <Field name="hasHeaders">
                            {({ field }) => (
                                <FormGroup controlId={field.name}>
                                    <FormCheck label="Has headers" type="checkbox" {...field} checked={field.value} />
                                    <ErrorMessage className="error-message" name={field.name} component="div" />
                                </FormGroup>
                            )}
                        </Field>
                        <Field name="csv">
                            {({ field }) => (
                                <FormGroup controlId={field.name}>
                                    <FormLabel>Station csv:</FormLabel>
                                    <FormControl as="textarea" style={{whiteSpace: "pre"}} {...field} />
                                    <ErrorMessage className="error-message" name={field.name} component="div" />
                                </FormGroup>
                            )}
                        </Field>

                        {this.state.parseError && <Alert className="mt-4" variant="danger">Parse error: {this.state.parseError}</Alert>}

                        <div className="mt-4 lower-right">
                            <Button disabled={isSubmitting} type="submit">Import</Button>
                        </div>
                        <Button className="mt-4 lower-left" variant="secondary" disabled={isSubmitting} onClick={this.props.onCancel}>Cancel</Button>
                    </Form>
                )}
            </Formik>
        </div>
    }
}

ImportStationsDialog.propTypes = {
    onSave: PropTypes.func.isRequired,
    onCancel: PropTypes.func.isRequired
};

export default ImportStationsDialog;