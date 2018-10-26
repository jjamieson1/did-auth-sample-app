package config

import (
	"os"
	"fmt"
	"encoding/json"
)

func LoadFile(file string) Config {
	var config Config
	configFile, err := os.Open(file)
	defer configFile.Close()
	if err != nil {
		fmt.Println(err.Error())
	}

	jsonParser := json.NewDecoder(configFile)
	jsonParser.Decode(&config)
	return config
}

type Config struct {
	Listener string `json:"listener"`
	ApiKey   string `json:"apiKey"`
	AppKey   string `json:"appKey"`
	C1Url    string `json:"c1Url"`
	C1SampleApp	string `json:"c1SampleApp"`
}